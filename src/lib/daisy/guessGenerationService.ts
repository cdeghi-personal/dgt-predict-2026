// Server-side only — geração autônoma de palpites da Daisy para as próximas 24h
import { sydleCall, parseSearch } from '@/lib/sydle/client'
import { SYDLE_PACKAGE, SYDLE_CLASS, SYDLE_METHOD } from '@/lib/sydle/constants'
import { fetchCountryMap } from '@/lib/sydle/helpers'
import { callOpenAI, parseJsonFromText } from './aiClient'
import { getAllPrompts } from './promptRepository'
import { saveDaisyGuesses } from './guessService'
import { fetchAndSummarizeNews, buildNewsContext } from './newsService'
import { DAISY_PROMPT_IDENTIFIERS } from './constants'
import type { SydleGame } from '@/lib/types'
import type { GenerateGuessesResult, DaisyGuessResult } from './types'

interface GuessAIResponse {
  gameId: string
  result1: number
  result2: number
  reasoning: string
}

export async function generateAndSaveDaisyGuesses(token: string): Promise<GenerateGuessesResult> {
  const startTime = Date.now()

  const now = Date.now()
  const in24h = now + 86_400_000

  const [prompts, upcomingRaw, countryMap] = await Promise.all([
    getAllPrompts(token),
    sydleCall(SYDLE_PACKAGE, SYDLE_CLASS.games, SYDLE_METHOD.search, {
      query: { range: { date: { gte: now, lte: in24h } } },
      sort: [{ date: { order: 'asc' } }],
      size: 20,
    }, token),
    fetchCountryMap(token).catch(() => new Map()),
  ])

  const upcomingGames = parseSearch<SydleGame>(upcomingRaw)

  if (upcomingGames.length === 0) {
    return {
      guesses: [],
      newsAnalyzed: 0,
      gamesFound: 0,
      executionMs: Date.now() - startTime,
      generatedAt: new Date().toISOString(),
    }
  }

  const promptMap = new Map(prompts.map((p) => [p.identifier, p]))
  const personaPrompt     = promptMap.get(DAISY_PROMPT_IDENTIFIERS.persona)?.prompt     ?? ''
  const guessesPrompt     = promptMap.get(DAISY_PROMPT_IDENTIFIERS.guesses)?.prompt     ?? 'Você é Daisy, consultora virtual da DGT. Analise os jogos abaixo e dê seus palpites de placar.'
  const newsSummaryPrompt = promptMap.get(DAISY_PROMPT_IDENTIFIERS.newsSummary)?.prompt ?? ''

  const newsResult = await fetchAndSummarizeNews(newsSummaryPrompt, personaPrompt)
  const newsContext = buildNewsContext(newsResult.summary)

  const gamesContext = upcomingGames.map((g) => {
    const c1 = countryMap.get(g.country1?._id ?? '')
    const c2 = countryMap.get(g.country2?._id ?? '')
    const name1 = c1?.country ?? g.country1?.name ?? g.country1?._id ?? '?'
    const name2 = c2?.country ?? g.country2?.name ?? g.country2?._id ?? '?'
    const phase = g.phase ?? 'grupos'
    const group = g.group ? ` · Grupo ${g.group}` : ''
    const dateStr = g.date
      ? new Date(typeof g.date === 'string' ? g.date : Number(g.date))
          .toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })
      : ''
    return `gameId:${g._id} | ${name1} vs ${name2} | ${phase}${group}${dateStr ? ` | ${dateStr}` : ''}`
  }).join('\n')

  const userMessage = [
    guessesPrompt,
    `\n\nJogos nas próximas 24 horas:\n${gamesContext}`,
    newsContext,
    '\n\nRetorne APENAS JSON válido: array de objetos com exatamente estes campos: gameId (string), result1 (número inteiro), result2 (número inteiro), reasoning (string curta em português com sua justificativa).',
  ].join('')

  const raw = await callOpenAI(personaPrompt, userMessage, { maxTokens: 1024, temperature: 0.7 })
  const aiGuesses = parseJsonFromText<GuessAIResponse[]>(raw)

  const validGuesses: DaisyGuessResult[] = []

  if (Array.isArray(aiGuesses)) {
    for (const g of aiGuesses) {
      const game = upcomingGames.find((ug) => ug._id === g.gameId)
      if (!game) continue
      const c1 = countryMap.get(game.country1?._id ?? '')
      const c2 = countryMap.get(game.country2?._id ?? '')
      validGuesses.push({
        gameId: g.gameId,
        country1: c1?.country ?? game.country1?.name ?? '?',
        country2: c2?.country ?? game.country2?.name ?? '?',
        result1: clamp(Number(g.result1) || 0),
        result2: clamp(Number(g.result2) || 0),
        reasoning: String(g.reasoning ?? '').slice(0, 200),
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
    guesses: validGuesses,
    newsAnalyzed: newsResult.successUrls.length,
    gamesFound: upcomingGames.length,
    executionMs: Date.now() - startTime,
    generatedAt: new Date().toISOString(),
  }
}

function clamp(n: number): number {
  return Math.max(0, Math.min(20, n))
}
