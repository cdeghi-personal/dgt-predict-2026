// Server-side only — orquestra geração do Diário da Daisy
// Arquitetura desacoplada para permitir extensões futuras:
//   - generateDiaryImage(diary, token) — capa do diário
//   - generateDiaryAudio(diary, token) — resumo em áudio
//   - generateDiaryNewsletter(diary, token) — newsletter
//   - generateDiaryVideo(diary, token) — vídeo curto
import { sydleCall, parseSearch } from '@/lib/sydle/client'
import { SYDLE_PACKAGE, SYDLE_CLASS, SYDLE_METHOD } from '@/lib/sydle/constants'
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
  const startTime = Date.now()

  const today = new Date()
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}T00:00:00Z`

  const [prompts, gamesRaw, resultsRaw, guessesRaw, upcomingRaw, recentDiaries] = await Promise.all([
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
    getMostRecentDiaries(3, token).catch(() => []),
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

  // Notícias das fontes externas (sem expor URLs na IA)
  const newsResult: NewsResult = await fetchAndSummarizeNews(newsSummaryPrompt, personaPrompt)
  const newsContext = buildNewsContext(newsResult.summary)

  // Posts anteriores — até 3, disponibilizados como contexto opcional
  const previousPostsContext = recentDiaries.length > 0
    ? '\n\nSeus posts anteriores (contexto opcional — do mais recente ao mais antigo):\n' +
      recentDiaries.map((d, i) => {
        const excerpt = d.content.replace(/[#*`>\-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 300)
        return `--- Post ${i + 1} (${d.createdAt.slice(0, 10)}) ---\nTítulo: ${d.title}\nSubtítulo: ${d.subtitle}\nExcerto: ${excerpt}…`
      }).join('\n\n') +
      '\n\nEsses posts são apenas referência de contexto. Conecte com o post anterior somente se houver uma continuidade natural que enriqueça a narrativa — caso contrário, ignore-os completamente e escreva como uma edição independente.'
    : ''

  // Instrução explícita para Markdown e sem citação de fontes
  const markdownInstruction = `
Retorne o conteúdo formatado em Markdown com seções usando ## para subtítulos, listas com *, negrito com ** e separadores com ---. Use seu próprio estilo — não cite portais, fontes ou sites. Escreva como se as ideias fossem suas, em primeira pessoa.
`

  // Gera diário via OpenAI
  const diaryUserMessage = [
    diaryPrompt,
    markdownInstruction,
    `\n\nResultados recentes:\n${matchContext}`,
    `\n\nPróximos jogos (24h):\n${upcomingContext}`,
    `\n\nTop 10 ranking:\n${rankingContext}`,
    newsContext,
    previousPostsContext,
    '\n\nRetorne APENAS JSON válido com os campos: title (string), subtitle (string), content (string com Markdown).',
  ].join('')

  const diaryRaw = await callOpenAI(personaPrompt, diaryUserMessage, { maxTokens: 2048, temperature: 0.8 })
  const diaryJson = parseJsonFromText<DiaryAIResponse>(diaryRaw)

  const diary = await createDiary(
    sanitize(diaryJson.title ?? 'Diário da Daisy'),
    sanitize(diaryJson.subtitle ?? ''),
    diaryJson.content ?? '',  // Markdown — não sanitizar com strip-tags
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

  const executionMs = Date.now() - startTime

  return {
    diary,
    newsResult,
    newsAnalyzed: newsResult.successUrls.length,
    gamesConsidered: finishedGames.length + upcomingGames.length,
    executionMs,
    generatedAt: new Date().toISOString(),
  }
}

function sanitize(text: string): string {
  return text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, '').trim()
}

function clamp(n: number): number {
  return Math.max(0, Math.min(20, n))
}
