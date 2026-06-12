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
import type { GenerateDiaryResult, NewsResult, DiaryDebugInfo, DiaryDebugGameEntry } from './types'

const BRT_OFFSET_MS = -3 * 60 * 60 * 1000
const AI_MODEL = 'gpt-4.1'

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
  country1: string; country2: string
  result1: number; result2: number
  group: string; phase: string; finishedAt: string
}

// Parse campos de data do SYDLE — podem vir como ms (number) ou ISO string
function parseTs(date: number | string | undefined): number {
  if (typeof date === 'number') return date
  if (typeof date === 'string' && date) return new Date(date).getTime()
  return NaN
}

function brtLabel(ms: number): string {
  return new Date(ms + BRT_OFFSET_MS).toISOString().replace('T', ' ').slice(0, 16) + ' BRT'
}

export async function generateDailyDiary(token: string): Promise<GenerateDiaryResult> {
  const startTime = Date.now()
  const now = Date.now()

  const today = new Date()
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}T00:00:00Z`

  // ── Busca paralela no SYDLE ──────────────────────────────────────────────────
  const [prompts, gamesRaw, resultsRaw, guessesRaw, allGamesRaw, recentDiaries, countryMap] = await Promise.all([
    getAllPrompts(token),
    // Jogos recentes (para detectar resultados) — data DESC, maior janela possível
    sydleCall(SYDLE_PACKAGE, SYDLE_CLASS.games, SYDLE_METHOD.search,
      { query: { match_all: {} }, sort: [{ date: { order: 'desc' } }], size: 50 }, token),
    // Todos os resultados para montar o resultMap
    sydleCall(SYDLE_PACKAGE, SYDLE_CLASS.results, SYDLE_METHOD.search,
      { query: { match_all: {} }, sort: [{ _creationDate: { order: 'desc' } }], size: 200 }, token),
    // Palpites para ranking
    sydleCall(SYDLE_PACKAGE, SYDLE_CLASS.guesses, SYDLE_METHOD.search,
      { query: { match_all: {} }, size: 1000 }, token),
    // Todos os jogos para filtrar próximos (client-side, evita depender de range query com tipo incerto)
    sydleCall(SYDLE_PACKAGE, SYDLE_CLASS.games, SYDLE_METHOD.search,
      { query: { match_all: {} }, sort: [{ date: { order: 'asc' } }], size: 200 }, token),
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
  const allGamesAll   = parseSearch<SydleGame>(allGamesRaw)
  const allGuesses    = parseSearch<SydleGuess>(guessesRaw).map(mapGuess)

  const resultMap = new Map(allResults.map((r) => [r.game?._id, r]))

  const countryName = (id: string | undefined) =>
    (id ? countryMap.get(id)?.country : undefined) ?? '?'

  // ── Janela de tempo para resultados "recentes" ──────────────────────────────
  // Usa a maior janela entre: desde o último diário e últimas 48h
  const last24h = now - 24 * 60 * 60 * 1000
  const last48h = now - 48 * 60 * 60 * 1000
  const lastDiaryTs = recentDiaries[0]?.createdAt
    ? new Date(recentDiaries[0].createdAt).getTime()
    : last24h
  // Math.min = timestamp mais antigo = janela maior
  const recentCutoff = Math.min(lastDiaryTs, last48h)

  // ── Itera jogos recentes — monta debug + resultados recentes ─────────────────
  const recentResultEntries: RecentResultEntry[] = []
  const allFinishedForContext: string[] = []
  const allGamesAnalyzed: DiaryDebugGameEntry[] = []

  for (const g of recentGames) {
    const r = resultMap.get(g._id)
    const gameTs = parseTs(g.date)
    const hasResult = !!r
    const isInFuture = !isNaN(gameTs) && gameTs > now
    const withinWindow = hasResult && !isNaN(gameTs) && !isInFuture && gameTs >= recentCutoff

    allGamesAnalyzed.push({
      gameId:      g._id,
      country1:    countryName(g.country1?._id),
      country2:    countryName(g.country2?._id),
      gameDateRaw: g.date,
      gameDateMs:  isNaN(gameTs) ? null : gameTs,
      hasResult,
      result1:     r?.result1,
      result2:     r?.result2,
      group:       g.group ?? '',
      phase:       g.phase ?? '',
      isInFuture,
      withinWindow,
    })

    if (!hasResult || isNaN(gameTs) || isInFuture) continue

    allFinishedForContext.push(
      `${countryName(g.country1?._id)} ${r!.result1} x ${r!.result2} ${countryName(g.country2?._id)}`
    )

    if (gameTs < recentCutoff) continue

    recentResultEntries.push({
      country1:   countryName(g.country1?._id),
      country2:   countryName(g.country2?._id),
      result1:    r!.result1,
      result2:    r!.result2,
      group:      g.group ?? '',
      phase:      g.phase ?? '',
      finishedAt: brtLabel(gameTs),
    })
  }

  const hasRecentResults   = recentResultEntries.length > 0
  const recentResultsCount = recentResultEntries.length

  // ── Próximos jogos (filtro client-side — mais confiável que range query) ──────
  const upcomingGames = allGamesAll
    .filter((g) => {
      const ts = parseTs(g.date)
      return !isNaN(ts) && ts > now
    })
    .sort((a, b) => parseTs(a.date) - parseTs(b.date))
    .slice(0, 15)

  const upcomingGamesCount = upcomingGames.length
  const upcomingGamesDebug = upcomingGames.map((g) => {
    const ts = parseTs(g.date)
    return {
      gameId:    g._id,
      country1:  countryName(g.country1?._id),
      country2:  countryName(g.country2?._id),
      gameDateMs: isNaN(ts) ? null : ts,
    }
  })

  // ── Jogos acontecidos sem resultado no sistema ───────────────────────────────
  const pendingResultGames = recentGames
    .filter((g) => {
      if (resultMap.has(g._id)) return false
      const ts = parseTs(g.date)
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

  // ── Próximos jogos para o prompt ─────────────────────────────────────────────
  const upcomingContext = upcomingGames.length
    ? upcomingGames.map((g) => `${countryName(g.country1?._id)} vs ${countryName(g.country2?._id)}`).join('\n')
    : 'Nenhum jogo programado nos próximos dias.'

  // ── Notícias ─────────────────────────────────────────────────────────────────
  const newsResult: NewsResult = await fetchAndSummarizeNews(newsSummaryPrompt, personaPrompt)
  const newsContext = buildNewsContext(newsResult.summary)
  const newsHighlightsCount = newsResult.items.length

  // ── Diagnóstico do contexto ──────────────────────────────────────────────────
  console.log(
    `[daisy] Context — Recent Results: ${recentResultsCount} | Upcoming Games: ${upcomingGamesCount} | News: ${newsHighlightsCount} | Cutoff: ${new Date(recentCutoff).toISOString()}`
  )
  console.log(
    `[daisy] Games analyzed: ${allGamesAnalyzed.length} total | ` +
    `with result: ${allGamesAnalyzed.filter((g) => g.hasResult).length} | ` +
    `in window: ${recentResultsCount} | ` +
    `date NaN: ${allGamesAnalyzed.filter((g) => g.gameDateMs === null).length}`
  )

  // ── Posts anteriores ─────────────────────────────────────────────────────────
  const previousPostsContext = recentDiaries.length > 0
    ? '\n\nSeus posts anteriores (referência de contexto — do mais recente ao mais antigo):\n' +
      recentDiaries.map((d, i) => {
        const excerpt = d.content.replace(/[#*`>\-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 300)
        return `--- Post ${i + 1} (${d.createdAt.slice(0, 10)}) ---\nTítulo: ${d.title}\nSubtítulo: ${d.subtitle}\nExcerto: ${excerpt}…`
      }).join('\n\n') +
      '\n\nEsses posts são apenas referência. Conecte só se houver continuidade natural — caso contrário, escreva como edição independente.'
    : ''

  // ── Blocos de contexto para o prompt ─────────────────────────────────────────
  const recentResultsBlock = hasRecentResults
    ? '\n\n⚠️ JOGOS ENCERRADOS RECENTEMENTE — OBRIGATÓRIO COMENTAR NO INÍCIO DO POST:\n' +
      JSON.stringify(recentResultEntries, null, 2)
    : '\n\nNenhum jogo encerrado no período recente.'

  const fullMatchHistoryContext = allFinishedForContext.length > 0
    ? '\n\nHistórico de resultados (referência):\n' + allFinishedForContext.slice(0, 10).join('\n')
    : ''

  const recentResultsInstruction = hasRecentResults
    ? `\n\n⚠️ INSTRUÇÃO OBRIGATÓRIA: Há ${recentResultsCount} jogo(s) encerrado(s) recentemente. ` +
      `O post DEVE COMEÇAR comentando esses resultados específicos (times, placar, destaques). ` +
      `NÃO inicie com notícias gerais, ranking ou próximos jogos.`
    : ''

  const markdownInstruction = `\nRetorne o conteúdo formatado em Markdown com seções usando ## para subtítulos, listas com *, negrito com ** e separadores com ---. Use seu próprio estilo — não cite portais, fontes ou sites. Escreva como se as ideias fossem suas, em primeira pessoa.\n`

  // ── Prompt final para a IA ────────────────────────────────────────────────────
  const diaryUserMessage = [
    diaryPrompt,
    recentResultsInstruction,
    markdownInstruction,
    recentResultsBlock,
    pendingResultContext,
    fullMatchHistoryContext,
    `\n\nPróximos jogos:\n${upcomingContext}`,
    `\n\nTop 10 ranking:\n${rankingContext}`,
    newsContext,
    previousPostsContext,
    '\n\nRetorne APENAS JSON válido com os campos: title (string), subtitle (string), content (string com Markdown).',
  ].join('')

  // ── Chama OpenAI ─────────────────────────────────────────────────────────────
  const rawAIResponse = await callOpenAI(personaPrompt, diaryUserMessage, {
    maxTokens: 2048,
    temperature: 0.8,
    model: AI_MODEL,
  })

  let diaryJson: DiaryAIResponse
  try {
    diaryJson = parseJsonFromText<DiaryAIResponse>(rawAIResponse)
  } catch {
    // Resposta não parseável como JSON — usa o texto bruto como content
    diaryJson = { title: 'Diário da Daisy', subtitle: '', content: rawAIResponse }
  }

  // ── Validação: se há resultados recentes, o conteúdo deve mencioná-los ────────
  const validationPassed = !hasRecentResults || (() => {
    const contentLower = (diaryJson.content ?? '').toLowerCase()
    return recentResultEntries.some(
      (e) =>
        contentLower.includes(e.country1.toLowerCase()) ||
        contentLower.includes(e.country2.toLowerCase())
    )
  })()

  const validationNote = !hasRecentResults
    ? 'Nenhum resultado recente para validar.'
    : validationPassed
      ? `IA mencionou ao menos um dos ${recentResultsCount} resultado(s) recente(s). ✅`
      : `IA ignorou os ${recentResultsCount} resultado(s) recente(s). ❌`

  const generatedAt = new Date().toISOString()

  const debugBase = {
    model:             AI_MODEL,
    generatedAt,
    cutoffMs:          recentCutoff,
    cutoffLabel:       `${new Date(recentCutoff).toISOString()} (${brtLabel(recentCutoff)})`,
    lastDiaryDate:     recentDiaries[0]?.createdAt,
    gamesRawCount:     recentGames.length,
    resultsRawCount:   allResults.length,
    promptsLoadedCount: prompts.length,
    allGamesAnalyzed,
    recentResultEntries,
    upcomingGamesDebug,
    newsItems:         newsResult.items.map((n) => ({ title: n.title, description: n.description })),
    promptsLoaded:     prompts.map((p) => ({
      identifier: p.identifier,
      version:    p.version,
      active:     p.active,
      preview:    p.prompt.slice(0, 300),
    })),
    finalPrompt:   diaryUserMessage,
    rawAIResponse,
  }

  // ── Bloqueio: não salva se a IA ignorou resultados recentes ──────────────────
  if (!validationPassed) {
    console.warn(`[daisy] Validation FAILED — ${validationNote}`)
    const debug: DiaryDebugInfo = {
      ...debugBase,
      savedPayload:    null,
      validationPassed: false,
      validationNote,
    }
    return {
      diary:          null,
      saved:          false,
      validationError: 'A IA ignorou os resultados recentes. O diário não foi salvo. Revise o debug do contexto.',
      debug,
      newsResult,
      newsAnalyzed:        newsResult.successUrls.length,
      recentResultsCount,
      upcomingGamesCount,
      newsHighlightsCount,
      hasRecentResults,
      gamesConsidered:     allFinishedForContext.length + upcomingGames.length,
      executionMs:         Date.now() - startTime,
      generatedAt,
    }
  }

  // ── Matérias salvas em featuredMatch ──────────────────────────────────────────
  const featuredMatch = newsResult.items.length > 0
    ? newsResult.items
        .map((item, i) => `[${i + 1}] ${item.title}\n${item.description}`)
        .join('\n\n')
    : undefined

  const savedPayload = {
    date:           dateStr,
    tytle:          sanitize(diaryJson.title ?? 'Diário da Daisy'),
    subtytle:       sanitize(diaryJson.subtitle ?? ''),
    contentPreview: (diaryJson.content ?? '').slice(0, 500),
    featuredMatch,
  }

  // ── Salva no SYDLE ───────────────────────────────────────────────────────────
  const diary = await createDiary(
    savedPayload.tytle,
    savedPayload.subtytle,
    diaryJson.content ?? '',
    token,
    dateStr,
    featuredMatch,
  )

  const debug: DiaryDebugInfo = {
    ...debugBase,
    savedPayload,
    validationPassed: true,
    validationNote,
  }

  // ── Palpites — fluxo em 2 passos (falha não é fatal) ────────────────────────
  if (upcomingGames.length > 0 && guessesPrompt) {
    try {
      const gamesCtx = upcomingGames.map((g) =>
        `gameId: ${g._id}, ${countryName(g.country1?._id)} vs ${countryName(g.country2?._id)}`
      ).join('\n')

      const fullResultsCtx =
        allFinishedForContext.slice(0, 10).join('\n') || 'Nenhum resultado registrado ainda.'

      // Passo 1 — análise por jogo (não fatal)
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

          const analysisRaw = await callOpenAI(personaPrompt, analysisInput, {
            maxTokens: 1024,
            temperature: 0.5,
          })
          const analysisArr = parseJsonFromText<
            { gameId: string; country1: string; country2: string; analysis: string }[]
          >(analysisRaw)

          if (Array.isArray(analysisArr) && analysisArr.length > 0) {
            analysisContext =
              '\n\nAnálise prévia dos jogos:\n' +
              analysisArr.map((a) => `${a.country1} vs ${a.country2}: ${a.analysis}`).join('\n')
          }
        } catch (err) {
          console.error('[daisy] match analysis step failed (non-fatal):', err)
        }
      }

      // Passo 2 — palpites com contexto completo
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
            gameId:  g.gameId,
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
    saved: true,
    debug,
    newsResult,
    newsAnalyzed:        newsResult.successUrls.length,
    recentResultsCount,
    upcomingGamesCount,
    newsHighlightsCount,
    hasRecentResults,
    gamesConsidered:     allFinishedForContext.length + upcomingGames.length,
    executionMs:         Date.now() - startTime,
    generatedAt,
  }
}

function sanitize(text: string): string {
  return text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, '').trim()
}

function clamp(n: number): number {
  return Math.max(0, Math.min(20, n))
}
