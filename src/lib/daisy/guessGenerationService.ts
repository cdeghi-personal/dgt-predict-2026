// Server-side only — geração autônoma de palpites da Daisy para as próximas 24h
// Fluxo: notícias → resumo → análise dos jogos → palpites → gravar
import { sydleCall, parseSearch } from '@/lib/sydle/client'
import { SYDLE_PACKAGE, SYDLE_CLASS, SYDLE_METHOD } from '@/lib/sydle/constants'
import { fetchCountryMap } from '@/lib/sydle/helpers'
import { callOpenAI, parseJsonFromText } from './aiClient'
import { getAllPrompts } from './promptRepository'
import { saveDaisyGuesses } from './guessService'
import { fetchAndSummarizeNews, buildNewsContext } from './newsService'
import { analyzeUpcomingMatches } from './matchAnalysisService'
import { DAISY_PROMPT_IDENTIFIERS } from './constants'
import type { SydleGame, SydleResult } from '@/lib/types'
import type { GenerateGuessesResult, DaisyGuessResult } from './types'

interface GuessAIResponse {
  gameId: string
  result1: number
  result2: number
  reasoning: string
}

export async function generateAndSaveDaisyGuesses(token: string): Promise<GenerateGuessesResult> {
  const startTime = Date.now()
  const now   = Date.now()
  const in24h = now + 86_400_000

  // ── Fase 1: dados (paralelo, sem IA) ──────────────────────────────────────
  const [prompts, upcomingRaw, allGamesRaw, allResultsRaw, countryMap] = await Promise.all([
    getAllPrompts(token),
    sydleCall(SYDLE_PACKAGE, SYDLE_CLASS.games, SYDLE_METHOD.search, {
      query: { range: { date: { gte: now, lte: in24h } } },
      sort: [{ date: { order: 'asc' } }],
      size: 20,
    }, token),
    sydleCall(SYDLE_PACKAGE, SYDLE_CLASS.games, SYDLE_METHOD.search, {
      query: { match_all: {} },
      size: 200,
    }, token),
    sydleCall(SYDLE_PACKAGE, SYDLE_CLASS.results, SYDLE_METHOD.search, {
      query: { match_all: {} },
      size: 500,
    }, token),
    fetchCountryMap(token).catch(() => new Map()),
  ])

  const upcomingGames = parseSearch<SydleGame>(upcomingRaw)
  const allGames      = parseSearch<SydleGame>(allGamesRaw)
  const allResults    = parseSearch<SydleResult>(allResultsRaw)

  if (upcomingGames.length === 0) {
    return {
      guesses: [],
      analyses: [],
      newsAnalyzed: 0,
      gamesFound: 0,
      executionMs: Date.now() - startTime,
      generatedAt: new Date().toISOString(),
    }
  }

  const promptMap = new Map(prompts.map((p) => [p.identifier, p]))
  const personaPrompt       = promptMap.get(DAISY_PROMPT_IDENTIFIERS.persona)?.prompt       ?? ''
  const newsSummaryPrompt   = promptMap.get(DAISY_PROMPT_IDENTIFIERS.newsSummary)?.prompt   ?? ''
  const matchAnalysisPrompt = promptMap.get(DAISY_PROMPT_IDENTIFIERS.matchAnalysis)?.prompt
    ?? 'Analise cada jogo considerando resultados recentes, classificação dos grupos e contexto da Copa.'
  const guessesPrompt       = promptMap.get(DAISY_PROMPT_IDENTIFIERS.guesses)?.prompt
    ?? 'Com base nas análises abaixo, dê seus palpites de placar para cada jogo.'

  // ── Fase 2: notícias → resumo ─────────────────────────────────────────────
  const newsResult  = await fetchAndSummarizeNews(newsSummaryPrompt, personaPrompt)
  const newsContext = buildNewsContext(newsResult.summary)

  // ── Fase 3: análise dos jogos (DAISY_MATCH_ANALYSIS) ─────────────────────
  const analyses = await analyzeUpcomingMatches({
    upcomingGames,
    allGames,
    allResults,
    countryMap,
    newsContext,
    matchAnalysisPrompt,
    personaPrompt,
  })

  // ── Fase 4: palpites (DAISY_DAILY_GUESSES) ────────────────────────────────
  // Contexto: análise por jogo + notícias. Sem palpites de participantes, sem ranking.
  const analysisContext = analyses.length > 0
    ? analyses
        .map((a) => `${a.country1} vs ${a.country2} (gameId:${a.gameId}):\n  ${a.analysis}`)
        .join('\n\n')
    : upcomingGames
        .map((g) => {
          const c1 = countryMap.get(g.country1?._id ?? '')
          const c2 = countryMap.get(g.country2?._id ?? '')
          return `${c1?.country ?? g.country1?.name ?? '?'} vs ${c2?.country ?? g.country2?.name ?? '?'} (gameId:${g._id})`
        })
        .join('\n')

  const guessUserMessage = [
    guessesPrompt,
    `\n\nAnálise dos jogos:\n${analysisContext}`,
    newsContext,
    '\n\nRetorne APENAS JSON válido: array de objetos com { gameId (string), result1 (inteiro), result2 (inteiro), reasoning (string curta em português com sua justificativa) }.',
  ].join('')

  const raw       = await callOpenAI(personaPrompt, guessUserMessage, { maxTokens: 1024, temperature: 0.7 })
  const aiGuesses = parseJsonFromText<GuessAIResponse[]>(raw)

  const validGuesses: DaisyGuessResult[] = []

  if (Array.isArray(aiGuesses)) {
    for (const g of aiGuesses) {
      const game     = upcomingGames.find((ug) => ug._id === g.gameId)
      const analysis = analyses.find((a)  => a.gameId === g.gameId)
      if (!game) continue
      const c1 = countryMap.get(game.country1?._id ?? '')
      const c2 = countryMap.get(game.country2?._id ?? '')
      validGuesses.push({
        gameId:   g.gameId,
        country1: analysis?.country1 ?? c1?.country ?? game.country1?.name ?? '?',
        country2: analysis?.country2 ?? c2?.country ?? game.country2?.name ?? '?',
        result1:  clamp(Number(g.result1) || 0),
        result2:  clamp(Number(g.result2) || 0),
        reasoning: String(g.reasoning ?? '').slice(0, 200),
        analysis:  analysis?.analysis,
      })
    }
  }

  if (validGuesses.length > 0) {
    await saveDaisyGuesses(
      validGuesses.map(({ gameId, result1, result2 }) => ({ gameId, result1, result2 })),
      token,
    )
  }

  return {
    guesses:     validGuesses,
    analyses,
    newsAnalyzed: newsResult.successUrls.length,
    gamesFound:   upcomingGames.length,
    executionMs:  Date.now() - startTime,
    generatedAt:  new Date().toISOString(),
  }
}

function clamp(n: number): number {
  return Math.max(0, Math.min(20, n))
}
