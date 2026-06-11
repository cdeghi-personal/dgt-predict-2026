// Server-side only — orquestra geração do Diário da Daisy
import { sydleCall, parseSearch } from '@/lib/sydle/client'
import { SYDLE_PACKAGE, SYDLE_CLASS, SYDLE_METHOD } from '@/lib/sydle/constants'
import { callClaude, parseJsonFromText } from './aiClient'
import { getAllPrompts } from './promptRepository'
import { createDiary } from './diaryRepository'
import { saveDaisyGuesses } from './guessService'
import { summarizeNewsUrls, buildNewsContext } from './newsService'
import { DAISY_PROMPT_IDENTIFIERS } from './constants'
import { calculatePoints } from '@/lib/utils/scoring'
import { mapGuess } from '@/lib/mappers'
import type { SydleGame, SydleResult, SydleGuess } from '@/lib/types'
import type { DaisyDiary } from '@/lib/types'

interface GenerateDiaryOptions {
  newsUrls?: string[]
  newsText?: string
  token: string
}

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

export async function generateDailyDiary(opts: GenerateDiaryOptions): Promise<DaisyDiary> {
  const { token } = opts

  // Load prompts and context data in parallel
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
  const personaPrompt  = promptMap.get(DAISY_PROMPT_IDENTIFIERS.persona)?.Prompt    ?? ''
  const diaryPrompt    = promptMap.get(DAISY_PROMPT_IDENTIFIERS.diary)?.Prompt      ?? ''
  const guessesPrompt  = promptMap.get(DAISY_PROMPT_IDENTIFIERS.guesses)?.Prompt    ?? ''
  const newsSummaryPrompt = promptMap.get(DAISY_PROMPT_IDENTIFIERS.newsSummary)?.Prompt ?? ''

  const recentGames   = parseSearch<SydleGame>(gamesRaw)
  const recentResults = parseSearch<SydleResult>(resultsRaw)
  const allGuesses    = parseSearch<SydleGuess>(guessesRaw).map(mapGuess)
  const upcomingGames = parseSearch<SydleGame>(upcomingRaw)

  const resultMap = new Map(recentResults.map((r) => [r.game?._id, r]))

  // Build match context (last 5 finished)
  const finishedGames = recentGames.filter((g) => resultMap.has(g._id)).slice(0, 5)
  const matchContext = finishedGames.map((g) => {
    const r = resultMap.get(g._id)!
    return `${g.country1?.name ?? '?'} ${r.result1} x ${r.result2} ${g.country2?.name ?? '?'}`
  }).join('\n') || 'Nenhum jogo finalizado ainda.'

  // Build ranking context from guesses
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

  // News context
  let newsContext = ''
  if (opts.newsText?.trim()) {
    newsContext = buildNewsContext(opts.newsText)
  } else if (opts.newsUrls?.length) {
    const summary = await summarizeNewsUrls(opts.newsUrls, newsSummaryPrompt, personaPrompt)
    newsContext = buildNewsContext(summary)
  }

  // Generate diary via AI
  const diaryUserMessage = [
    diaryPrompt,
    `\n\nJogos recentes:\n${matchContext}`,
    `\n\nTop 10 ranking:\n${rankingContext}`,
    newsContext,
    '\n\nRetorne APENAS JSON válido com os campos: title, subtitle, content.',
  ].join('')

  const diaryRaw = await callClaude(personaPrompt, diaryUserMessage, { maxTokens: 2048, temperature: 0.8 })
  const diaryJson = parseJsonFromText<DiaryAIResponse>(diaryRaw)

  const diary = await createDiary(
    sanitize(diaryJson.title ?? 'Diário da Daisy'),
    sanitize(diaryJson.subtitle ?? ''),
    sanitize(diaryJson.content ?? ''),
    token,
  )

  // Generate guesses for upcoming games (errors are non-fatal)
  if (upcomingGames.length > 0 && guessesPrompt) {
    try {
      const gamesCtx = upcomingGames.map((g) =>
        `gameId: ${g._id}, ${g.country1?.name ?? '?'} vs ${g.country2?.name ?? '?'}`
      ).join('\n')

      const guessRaw = await callClaude(
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

  return diary
}

function sanitize(text: string): string {
  return text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, '').trim()
}

function clamp(n: number): number {
  return Math.max(0, Math.min(20, n))
}
