// Server-side only — orquestra geração do Diário da Daisy
import { sydleCall, parseSearch } from '@/lib/sydle/client'
import { SYDLE_PACKAGE, SYDLE_CLASS, SYDLE_METHOD } from '@/lib/sydle/constants'
import { fetchCountryMap } from '@/lib/sydle/helpers'
import { callOpenAI, parseJsonFromText } from './aiClient'
import { getAllPrompts } from './promptRepository'
import { createDiary, getMostRecentDiaries } from './diaryRepository'
import { saveDaisyGuesses } from './guessService'
import { fetchAndSummarizeNews, buildNewsContext } from './newsService'
import { DAISY_PROMPT_IDENTIFIERS } from './constants'
import { calculatePoints } from '@/lib/utils/scoring'
import { mapGuess } from '@/lib/mappers'
import type { SydleGame, SydleResult, SydleGuess } from '@/lib/types'
import type { GenerateDiaryResult, NewsResult } from './types'

const BRT_OFFSET_MS = -3 * 60 * 60 * 1000

interface DiaryAIResponse {
  title: string
  subtitle: string
  content: string
}

interface GuessAIResponse {
  gameId: string
  result1: number
  result2: number
}

interface RecentResultEntry {
  country1: string
  country2: string
  result1: number
  result2: number
  group: string
  phase: string
  finishedAt: string  // "YYYY-MM-DD HH:MM BRT"
}

export async function generateDailyDiary(token: string): Promise<GenerateDiaryResult> {
  const startTime = Date.now()
  const now = Date.now()

  const today = new Date()
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}T00:00:00Z`

  const [prompts, gamesRaw, resultsRaw, guessesRaw, upcomingRaw, recentDiaries, countryMap] = await Promise.all([
    getAllPrompts(token),
    // Jogos recentes (data DESC) — cobre ~3-4 dias da Copa
    sydleCall(SYDLE_PACKAGE, SYDLE_CLASS.games, SYDLE_METHOD.search,
      { query: { match_all: {} }, sort: [{ date: { order: 'desc' } }], size: 20 }, token),
    // Todos os resultados para montar o resultMap
    sydleCall(SYDLE_PACKAGE, SYDLE_CLASS.results, SYDLE_METHOD.search,
      { query: { match_all: {} }, sort: [{ _creationDate: { order: 'desc' } }], size: 50 }, token),
    sydleCall(SYDLE_PACKAGE, SYDLE_CLASS.guesses, SYDLE_METHOD.search,
      { query: { match_all: {} }, size: 1000 }, token),
    // Próximos jogos — próximas 24h
    sydleCall(SYDLE_PACKAGE, SYDLE_CLASS.games, SYDLE_METHOD.search,
      { query: { range: { date: { gte: now, lte: now + 86_400_000 } } },
        sort: [{ date: { order: 'asc' } }], size: 10 }, token),
    getMostRecentDiaries(3, token).catch(() => []),
    fetchCountryMap(token).catch(() => new Map()),
  ])

  const promptMap = new Map(prompts.map((p) => [p.identifier, p]))
  const personaPrompt       = promptMap.get(DAISY_PROMPT_IDENTIFIERS.persona)?.prompt       ?? ''
  const diaryPrompt         = promptMap.get(DAISY_PROMPT_IDENTIFIERS.diary)?.prompt         ?? ''
  const guessesPrompt       = promptMap.get(DAISY_PROMPT_IDENTIFIERS.guesses)?.prompt       ?? ''
  const newsSummaryPrompt   = promptMap.get(DAISY_PROMPT_IDENTIFIERS.newsSummary)?.prompt   ?? ''
  const matchAnalysisPrompt = promptMap.get(DAISY_PROMPT_IDENTIFIERS.matchAnalysis)?.prompt ?? ''

  const recentGames   = parseSearch<SydleGame>(gamesRaw)
  const allResults    = parseSearch<SydleResult>(resultsRaw)
  const allGuesses    = parseSearch<SydleGuess>(guessesRaw).map(mapGuess)
  const upcomingGames = parseSearch<SydleGame>(upcomingRaw)

  const resultMap = new Map(allResults.map((r) => [r.game?._id, r]))

  const countryName = (id: string | undefined) =>
    (id ? countryMap.get(id)?.country : undefined) ?? '?'

  // ── Janela de tempo para resultados "recentes" ──────────────────────────────
  // Usa a criação do último diário como referência, com fallback de 48h
  const last48h = now - 48 * 60 * 60 * 1000
  const lastDiaryTs = recentDiaries[0]?.createdAt
    ? new Date(recentDiaries[0].createdAt).getTime()
    : last48h
  const recentCutoff = Math.min(lastDiaryTs, last48h)

  // ── Resultados recentes estruturados (jogos encerrados desde o corte) ───────
  const recentResultEntries: RecentResultEntry[] = []
  const allFinishedForContext: string[] = []

  for (const g of recentGames) {
    const r = resultMap.get(g._id)
    if (!r) continue
    const gameTs = typeof g.date === 'number' ? g.date : Number(g.date)
    if (isNaN(gameTs) || gameTs > now) continue  // futuro — ignorar

    // Para contexto histórico completo
    allFinishedForContext.push(
      `${countryName(g.country1?._id)} ${r.result1} x ${r.result2} ${countryName(g.country2?._id)}`
    )

    // Apenas jogos dentro da janela recente
    if (gameTs < recentCutoff) continue

    const brtDate = new Date(gameTs + BRT_OFFSET_MS)
    recentResultEntries.push({
      country1:   countryName(g.country1?._id),
      country2:   countryName(g.country2?._id),
      result1:    r.result1,
      result2:    r.result2,
      group:      g.group ?? '',
      phase:      g.phase ?? '',
      finishedAt: brtDate.toISOString().replace('T', ' ').slice(0, 16) + ' BRT',
    })
  }

  const hasRecentResults   = recentResultEntries.length > 0
  const recentResultsCount = recentResultEntries.length
  const upcomingGamesCount = upcomingGames.length

  // ── Jogos que aconteceram mas sem resultado no sistema ───────────────────────
  const pendingResultGames = recentGames
    .filter((g) => {
      if (resultMap.has(g._id)) return false
      const ts = typeof g.date === 'number' ? g.date : Number(g.date)
      return !isNaN(ts) && ts < now
    })
    .slice(0, 5)
  const pendingResultContext = pendingResultGames.length > 0
    ? '\n\nJogos recentes sem resultado no sistema (já aconteceram — use as notícias para comentar):\n' +
      pendingResultGames.map((g) => `${countryName(g.country1?._id)} vs ${countryName(g.country2?._id)}`).join('\n')
    : ''

  // ── Top 10 ranking ───────────────────────────────────────────────────────────
  const userAccum = new Map<string, { name: string; pts: number }>()
  for (const guess of allGuesses) {
    const result = resultMap.get(guess.matchId)
    if (!result) continue
    const { points } = calculatePoints(guess.result1, guess.result2, result.result1, result.result2)
    const prev = userAccum.get(guess.userId) ?? { name: guess.userName, pts: 0 }
    prev.pts += points
    userAccum.set(guess.userId, prev)
  }
  const topUsers = [...userAccum.entries()]
    .sort((a, b) => b[1].pts - a[1].pts)
    .slice(0, 10)
  const rankingContext = topUsers.length
    ? topUsers.map(([, u], i) => `${i + 1}. ${u.name} — ${u.pts} pts`).join('\n')
    : 'Ranking ainda sem pontuação.'

  // ── Próximos jogos ───────────────────────────────────────────────────────────
  const upcomingContext = upcomingGames.length
    ? upcomingGames.map((g) => `${countryName(g.country1?._id)} vs ${countryName(g.country2?._id)}`).join('\n')
    : 'Nenhum jogo nas próximas 24h.'

  // ── Notícias ─────────────────────────────────────────────────────────────────
  const newsResult: NewsResult = await fetchAndSummarizeNews(newsSummaryPrompt, personaPrompt)
  const newsContext = buildNewsContext(newsResult.summary)
  const newsHighlightsCount = newsResult.items.length

  // ── Diagnóstico do contexto ──────────────────────────────────────────────────
  console.log(
    `[daisy] Context — Recent Results: ${recentResultsCount} | Upcoming Games: ${upcomingGamesCount} | News Highlights: ${newsHighlightsCount}`
  )

  // ── Posts anteriores ─────────────────────────────────────────────────────────
  const previousPostsContext = recentDiaries.length > 0
    ? '\n\nSeus posts anteriores (contexto opcional — do mais recente ao mais antigo):\n' +
      recentDiaries.map((d, i) => {
        const excerpt = d.content.replace(/[#*`>\-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 300)
        return `--- Post ${i + 1} (${d.createdAt.slice(0, 10)}) ---\nTítulo: ${d.title}\nSubtítulo: ${d.subtitle}\nExcerto: ${excerpt}…`
      }).join('\n\n') +
      '\n\nEsses posts são apenas referência de contexto. Conecte com post anterior só se houver continuidade natural — caso contrário, escreva como edição independente.'
    : ''

  // ── Contexto de resultados recentes (bloco principal do prompt) ───────────────
  const recentResultsBlock = hasRecentResults
    ? '\n\n⚠️ JOGOS ENCERRADOS RECENTEMENTE — OBRIGATÓRIO COMENTAR NO INÍCIO DO POST:\n' +
      JSON.stringify(recentResultEntries, null, 2)
    : '\n\nNenhum jogo encerrado no período recente.'

  // Histórico completo para referência adicional
  const fullMatchHistoryContext = allFinishedForContext.length > 0
    ? '\n\nHistórico de resultados (referência):\n' + allFinishedForContext.slice(0, 10).join('\n')
    : ''

  // Instrução de alerta quando há resultados — reforça a prioridade
  const recentResultsInstruction = hasRecentResults
    ? `\n\n⚠️ INSTRUÇÃO OBRIGATÓRIA: Há ${recentResultsCount} jogo(s) encerrado(s) recentemente. ` +
      `O post DEVE COMEÇAR comentando esses resultados específicos (times, placar, destaques). ` +
      `NÃO inicie com notícias gerais, ranking ou próximos jogos.`
    : ''

  const markdownInstruction = `
Retorne o conteúdo formatado em Markdown com seções usando ## para subtítulos, listas com *, negrito com ** e separadores com ---. Use seu próprio estilo — não cite portais, fontes ou sites. Escreva como se as ideias fossem suas, em primeira pessoa.
`

  // ── Gera diário via OpenAI ───────────────────────────────────────────────────
  const diaryUserMessage = [
    diaryPrompt,
    recentResultsInstruction,
    markdownInstruction,
    recentResultsBlock,
    pendingResultContext,
    fullMatchHistoryContext,
    `\n\nPróximos jogos (24h):\n${upcomingContext}`,
    `\n\nTop 10 ranking:\n${rankingContext}`,
    newsContext,
    previousPostsContext,
    '\n\nRetorne APENAS JSON válido com os campos: title (string), subtitle (string), content (string com Markdown).',
  ].join('')

  const diaryRaw = await callOpenAI(personaPrompt, diaryUserMessage, { maxTokens: 2048, temperature: 0.8 })
  const diaryJson = parseJsonFromText<DiaryAIResponse>(diaryRaw)

  // Matérias usadas pela IA — salvas no campo featuredMatch do SYDLE
  const featuredMatch = newsResult.items.length > 0
    ? newsResult.items
        .map((item, i) => `[${i + 1}] ${item.title}\n${item.description}`)
        .join('\n\n')
    : undefined

  const diary = await createDiary(
    sanitize(diaryJson.title ?? 'Diário da Daisy'),
    sanitize(diaryJson.subtitle ?? ''),
    diaryJson.content ?? '',
    token,
    dateStr,
    featuredMatch,
  )

  // ── Palpites — fluxo em 2 passos (falha não é fatal) ────────────────────────
  if (upcomingGames.length > 0 && guessesPrompt) {
    try {
      const gamesCtx = upcomingGames.map((g) =>
        `gameId: ${g._id}, ${countryName(g.country1?._id)} vs ${countryName(g.country2?._id)}`
      ).join('\n')

      const fullResultsCtx = allFinishedForContext.slice(0, 10).join('\n') || 'Nenhum resultado registrado ainda.'

      // Passo 1 — DAISY_MATCH_ANALYSIS: análise por jogo
      let analysisContext = ''
      if (matchAnalysisPrompt) {
        try {
          const analysisInput = [
            matchAnalysisPrompt,
            hasRecentResults
              ? '\n\nResultados recentes:\n' + JSON.stringify(recentResultEntries, null, 2)
              : '\n\nResultados recentes:\n' + (fullResultsCtx || 'Nenhum resultado registrado ainda.'),
            pendingResultContext,
            newsContext,
            `\n\nJogos para análise:\n${gamesCtx}`,
            '\n\nRetorne APENAS JSON válido: array de objetos com gameId, country1, country2, analysis.',
          ].join('')

          const analysisRaw = await callOpenAI(personaPrompt, analysisInput, { maxTokens: 1024, temperature: 0.5 })
          const analysisArr = parseJsonFromText<{ gameId: string; country1: string; country2: string; analysis: string }[]>(analysisRaw)

          if (Array.isArray(analysisArr) && analysisArr.length > 0) {
            analysisContext = '\n\nAnálise prévia dos jogos:\n' +
              analysisArr.map((a) => `${a.country1} vs ${a.country2}: ${a.analysis}`).join('\n')
          }
        } catch (err) {
          console.error('[daisy] match analysis step failed (non-fatal):', err)
        }
      }

      // Passo 2 — DAISY_DAILY_GUESSES: gera palpites com contexto completo
      const guessRaw = await callOpenAI(
        personaPrompt,
        [
          guessesPrompt,
          `\n\nResultados recentes:\n${fullResultsCtx}`,
          pendingResultContext,
          newsContext,
          analysisContext,
          `\n\nJogos para as próximas 24h:\n${gamesCtx}`,
          '\n\nRetorne APENAS JSON válido: array de objetos com gameId, result1 e result2.',
        ].join(''),
        { maxTokens: 512, temperature: 0.7 },
      )

      const guessArr = parseJsonFromText<GuessAIResponse[]>(guessRaw)
      if (Array.isArray(guessArr) && guessArr.length > 0) {
        await saveDaisyGuesses(
          guessArr.map((g) => ({
            gameId: g.gameId,
            result1: clamp(Number(g.result1) || 0),
            result2: clamp(Number(g.result2) || 0),
          })),
          token,
        )
      }
    } catch (err) {
      console.error('[daisy] guess generation failed:', err)
    }
  }

  const executionMs = Date.now() - startTime

  return {
    diary,
    newsResult,
    newsAnalyzed:        newsResult.successUrls.length,
    recentResultsCount,
    upcomingGamesCount,
    newsHighlightsCount,
    hasRecentResults,
    gamesConsidered:     allFinishedForContext.length + upcomingGames.length,
    executionMs,
    generatedAt:         new Date().toISOString(),
  }
}

function sanitize(text: string): string {
  return text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, '').trim()
}

function clamp(n: number): number {
  return Math.max(0, Math.min(20, n))
}
