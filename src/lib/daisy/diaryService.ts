// Server-side only — orquestra geração do Diário da Daisy
import { sydleCall, parseSearch } from '@/lib/sydle/client'
import { SYDLE_PACKAGE, SYDLE_CLASS, SYDLE_METHOD } from '@/lib/sydle/constants'
import { callOpenAI, parseJsonFromText } from './aiClient'
import { getAllPrompts } from './promptRepository'
import { createDiary } from './diaryRepository'
import { saveDaisyGuesses } from './guessService'
import { fetchAndSummarizeNews, buildNewsContext } from './newsService'
import { DAISY_PROMPT_IDENTIFIERS } from './constants'
import { calculatePoints } from '@/lib/utils/scoring'
import { mapGuess } from '@/lib/mappers'
import type { SydleGame, SydleResult, SydleGuess } from '@/lib/types'
import type { GenerateDiaryResult, NewsResult } from './types'

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

export async function generateDailyDiary(token: string): Promise<GenerateDiaryResult> {
  const today = new Date()
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}T00:00:00Z`

  const [prompts, gamesRaw, resultsRaw, guessesRaw, upcomingRaw] = await Promise.all([
    getAllPrompts(token),
    sydleCall(SYDLE_PACKAGE, SYDLE_CLASS.games, SYDLE_METHOD.search,
      { query: { match_all: {} }, sort: [{ date: { order: 'desc' } }], size: 15 }, token),
    sydleCall(SYDLE_PACKAGE, SYDLE_CLASS.results, SYDLE_METHOD.search,
      { query: { match_all: {} }, sort: [{ _creationDate: { order: 'desc' } }], size: 10 }, token),
    sydleCall(SYDLE_PACKAGE, SYDLE_CLASS.guesses, SYDLE_METHOD.search,
      { query: { match_all: {} }, size: 1000 }, token),
    sydleCall(SYDLE_PACKAGE, SYDLE_CLASS.games, SYDLE_METHOD.search,
      { query: { range: { date: { gte: Date.now(), lte: Date.now() + 86_400_000 } } }, sort: [{ date: { order: 'asc' } }], size: 10 },
      token),
  ])

  const promptMap = new Map(prompts.map((p) => [p.identifier, p]))
  const personaPrompt     = promptMap.get(DAISY_PROMPT_IDENTIFIERS.persona)?.prompt     ?? ''
  const diaryPrompt       = promptMap.get(DAISY_PROMPT_IDENTIFIERS.diary)?.prompt       ?? ''
  const guessesPrompt     = promptMap.get(DAISY_PROMPT_IDENTIFIERS.guesses)?.prompt     ?? ''
  const newsSummaryPrompt = promptMap.get(DAISY_PROMPT_IDENTIFIERS.newsSummary)?.prompt ?? ''

  const recentGames   = parseSearch<SydleGame>(gamesRaw)
  const recentResults = parseSearch<SydleResult>(resultsRaw)
  const allGuesses    = parseSearch<SydleGuess>(guessesRaw).map(mapGuess)
  const upcomingGames = parseSearch<SydleGame>(upcomingRaw)

  const resultMap = new Map(recentResults.map((r) => [r.game?._id, r]))

  // Últimos 5 jogos finalizados
  const finishedGames = recentGames.filter((g) => resultMap.has(g._id)).slice(0, 5)
  const matchContext = finishedGames.map((g) => {
    const r = resultMap.get(g._id)!
    return `${g.country1?.name ?? '?'} ${r.result1} x ${r.result2} ${g.country2?.name ?? '?'}`
  }).join('\n') || 'Nenhum jogo finalizado ainda.'

  // Top 10 ranking calculado inline
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

  // Próximos jogos
  const upcomingContext = upcomingGames.length
    ? upcomingGames.map((g) => `${g.country1?.name ?? '?'} vs ${g.country2?.name ?? '?'}`).join('\n')
    : 'Nenhum jogo nas próximas 24h.'

  // Notícias das 5 fontes externas
  const newsResult: NewsResult = await fetchAndSummarizeNews(newsSummaryPrompt, personaPrompt)
  const newsContext = buildNewsContext(newsResult.summary)

  // Gera diário via OpenAI
  const diaryUserMessage = [
    diaryPrompt,
    `\n\nResultados recentes:\n${matchContext}`,
    `\n\nPróximos jogos (24h):\n${upcomingContext}`,
    `\n\nTop 10 ranking:\n${rankingContext}`,
    newsContext,
    '\n\nRetorne APENAS JSON válido com os campos: title, subtitle, content.',
  ].join('')

  const diaryRaw = await callOpenAI(personaPrompt, diaryUserMessage, { maxTokens: 2048, temperature: 0.8 })
  const diaryJson = parseJsonFromText<DiaryAIResponse>(diaryRaw)

  const diary = await createDiary(
    sanitize(diaryJson.title ?? 'Diário da Daisy'),
    sanitize(diaryJson.subtitle ?? ''),
    sanitize(diaryJson.content ?? ''),
    token,
    dateStr,
  )

  // Palpites para os próximos jogos (falha não é fatal)
  if (upcomingGames.length > 0 && guessesPrompt) {
    try {
      const gamesCtx = upcomingGames.map((g) =>
        `gameId: ${g._id}, ${g.country1?.name ?? '?'} vs ${g.country2?.name ?? '?'}`
      ).join('\n')

      const guessRaw = await callOpenAI(
        personaPrompt,
        `${guessesPrompt}\n\nJogos para as próximas 24h:\n${gamesCtx}\n\nRetorne APENAS JSON válido: array de objetos com gameId, result1 e result2.`,
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

  return {
    diary,
    newsResult,
    generatedAt: new Date().toISOString(),
  }
}

function sanitize(text: string): string {
  return text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, '').trim()
}

function clamp(n: number): number {
  return Math.max(0, Math.min(20, n))
}
