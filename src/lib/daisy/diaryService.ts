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
import type {
  GenerateDiaryResult, NewsResult,
  DiaryDebugInfo, DiaryDebugGameEntry, ResultDebugEntry,
} from './types'

const BRT_OFFSET_MS = -3 * 60 * 60 * 1000
const AI_MODEL = 'gpt-4.1'

interface DiaryAIResponse { title: string; subtitle: string; content: string }
interface GuessAIResponse  { gameId: string; result1: number; result2: number }

interface RecentResultEntry {
  country1: string; country2: string
  result1: number; result2: number
  group: string; phase: string; finishedAt: string
}

// Parse campos de data SYDLE — podem vir como ms (number) ou ISO string
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
    // Jogos recentes (para debug e contexto histórico) — data DESC
    sydleCall(SYDLE_PACKAGE, SYDLE_CLASS.games, SYDLE_METHOD.search,
      { query: { match_all: {} }, sort: [{ date: { order: 'desc' } }], size: 50 }, token),
    // Todos os resultados — base da detecção de jogos recentes
    sydleCall(SYDLE_PACKAGE, SYDLE_CLASS.results, SYDLE_METHOD.search,
      { query: { match_all: {} }, sort: [{ _creationDate: { order: 'desc' } }], size: 200 }, token),
    sydleCall(SYDLE_PACKAGE, SYDLE_CLASS.guesses, SYDLE_METHOD.search,
      { query: { match_all: {} }, size: 1000 }, token),
    // TODOS os jogos para gameMap (client-side lookup) — evita problema de size/sort
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

  const recentGames = parseSearch<SydleGame>(gamesRaw)
  const allResults  = parseSearch<SydleResult>(resultsRaw)
  const allGamesAll = parseSearch<SydleGame>(allGamesRaw)
  const allGuesses  = parseSearch<SydleGuess>(guessesRaw).map(mapGuess)

  // gameMap: lookup de jogo por ID — cobre TODOS os jogos do torneio
  const gameMap     = new Map(allGamesAll.map((g) => [g._id, g]))
  // resultMap: usado para o debug "allGamesAnalyzed" (visão jogo-primeiro)
  const resultMap   = new Map(allResults.map((r) => [r.game?._id, r]))

  const countryName = (id: string | undefined) =>
    (id ? countryMap.get(id)?.country : undefined) ?? '?'

  // ── Janela de tempo para resultados "recentes" ───────────────────────────────
  const last24h = now - 24 * 60 * 60 * 1000
  const last48h = now - 48 * 60 * 60 * 1000
  const lastDiaryTs = recentDiaries[0]?.createdAt
    ? new Date(recentDiaries[0].createdAt).getTime()
    : last24h
  const recentCutoff = Math.max(lastDiaryTs, last48h)   // só jogos após o último diário (fallback: 48h)

  // ── FIX: visão RESULTADO-PRIMEIRO ───────────────────────────────────────────
  // Antes: iterava jogos e buscava resultado → perdia jogos fora dos top-50 por data
  // Agora: itera resultados e resolve o jogo via gameMap (cobre todos os 200 jogos)
  const recentResultEntries: RecentResultEntry[] = []
  const olderResultEntries: RecentResultEntry[] = []
  const allFinishedForContext: string[] = []
  const resultsDebug: ResultDebugEntry[] = []

  for (const r of allResults) {
    const gameId = r.game?._id ?? ''
    const g      = gameMap.get(gameId)
    const gameTs = g ? parseTs(g.date) : NaN

    const gameFoundInMap = !!g
    const isInFuture     = gameFoundInMap && !isNaN(gameTs) && gameTs > now
    const withinWindow   = gameFoundInMap && !isNaN(gameTs) && !isInFuture && gameTs >= recentCutoff

    resultsDebug.push({
      resultId:       r._id,
      gameId,
      country1:       g ? countryName(g.country1?._id) : '?',
      country2:       g ? countryName(g.country2?._id) : '?',
      score:          `${r.result1}×${r.result2}`,
      gameDateMs:     (g && !isNaN(gameTs)) ? gameTs : null,
      gameDateLabel:  !g ? 'não encontrado no gameMap' : isNaN(gameTs) ? 'NaN' : new Date(gameTs).toISOString().slice(0, 16),
      gameFoundInMap,
      isInFuture,
      withinWindow,
    })

    if (!g || isNaN(gameTs) || isInFuture) continue

    allFinishedForContext.push(
      `${countryName(g.country1?._id)} ${r.result1} x ${r.result2} ${countryName(g.country2?._id)}`
    )

    if (!withinWindow) {
      olderResultEntries.push({
        country1:   countryName(g.country1?._id),
        country2:   countryName(g.country2?._id),
        result1:    r.result1,
        result2:    r.result2,
        group:      g.group ?? '',
        phase:      g.phase ?? '',
        finishedAt: brtLabel(gameTs),
      })
      continue
    }

    recentResultEntries.push({
      country1:   countryName(g.country1?._id),
      country2:   countryName(g.country2?._id),
      result1:    r.result1,
      result2:    r.result2,
      group:      g.group ?? '',
      phase:      g.phase ?? '',
      finishedAt: brtLabel(gameTs),
    })
  }

  const hasRecentResults   = recentResultEntries.length > 0
  const recentResultsCount = recentResultEntries.length

  // ── Jogos já comentados em diários anteriores (subset de olderResultEntries) ──
  const recentDiaryTexts = recentDiaries.map((d) =>
    `${d.title ?? ''} ${d.subtitle ?? ''} ${d.content ?? ''}`.toLowerCase()
  )
  const recentlyCommentedGames = olderResultEntries
    .filter((e) =>
      recentDiaryTexts.some(
        (text) =>
          text.includes(e.country1.toLowerCase()) ||
          text.includes(e.country2.toLowerCase())
      )
    )
    .map((e) => `${e.country1} ${e.result1}×${e.result2} ${e.country2}`)

  // ── Debug: visão jogo-primeiro (top 50 por data DESC) ───────────────────────
  // Mantida para diagnóstico — mostra se algum jogo tem data NaN ou problemas similares
  const allGamesAnalyzed: DiaryDebugGameEntry[] = recentGames.map((g) => {
    const r       = resultMap.get(g._id)
    const gameTs  = parseTs(g.date)
    const isInFuture  = !isNaN(gameTs) && gameTs > now
    const withinWindow = !!r && !isNaN(gameTs) && !isInFuture && gameTs >= recentCutoff
    return {
      gameId:      g._id,
      country1:    countryName(g.country1?._id),
      country2:    countryName(g.country2?._id),
      gameDateRaw: g.date,
      gameDateMs:  isNaN(gameTs) ? null : gameTs,
      hasResult:   !!r,
      result1:     r?.result1,
      result2:     r?.result2,
      group:       g.group ?? '',
      phase:       g.phase ?? '',
      isInFuture,
      withinWindow,
    }
  })

  // ── Próximos jogos (filtro client-side, sem depender de range query) ─────────
  const upcomingGames = allGamesAll
    .filter((g) => { const ts = parseTs(g.date); return !isNaN(ts) && ts > now })
    .sort((a, b) => parseTs(a.date) - parseTs(b.date))
    .slice(0, 15)

  const upcomingGamesCount = upcomingGames.length
  const upcomingGamesDebug = upcomingGames.map((g) => {
    const ts = parseTs(g.date)
    return { gameId: g._id, country1: countryName(g.country1?._id), country2: countryName(g.country2?._id), gameDateMs: isNaN(ts) ? null : ts }
  })

  // ── Jogos sem resultado no sistema ──────────────────────────────────────────
  const pendingResultGames = allGamesAll
    .filter((g) => { const ts = parseTs(g.date); return !resultMap.has(g._id) && !isNaN(ts) && ts < now })
    .sort((a, b) => parseTs(b.date) - parseTs(a.date))
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
  const topUsers = [...userAccum.entries()].sort((a, b) => b[1].pts - a[1].pts).slice(0, 10)
  const rankingContext = topUsers.length
    ? topUsers.map(([, u], i) => `${i + 1}. ${u.name} — ${u.pts} pts`).join('\n')
    : 'Ranking ainda sem pontuação.'

  const upcomingContext = upcomingGames.length
    ? upcomingGames.map((g) => `${countryName(g.country1?._id)} vs ${countryName(g.country2?._id)}`).join('\n')
    : 'Nenhum jogo programado nos próximos dias.'

  // ── Notícias ─────────────────────────────────────────────────────────────────
  const newsResult: NewsResult = await fetchAndSummarizeNews(newsSummaryPrompt, personaPrompt)
  const newsContext = buildNewsContext(newsResult.summary)
  // FIX: métrica correta — quantas fontes responderam (items é sempre [])
  const newsHighlightsCount = newsResult.successUrls.length

  // ── Diagnóstico de contexto ──────────────────────────────────────────────────
  console.log(
    `[daisy] Context — Results: ${allResults.length} raw / ${recentResultsCount} recent | ` +
    `Games: ${allGamesAll.length} all / ${recentGames.length} recent-query | ` +
    `Upcoming: ${upcomingGamesCount} | News: ${newsHighlightsCount} OK / ${newsResult.errorUrls.length} ERR | ` +
    `Summary: ${newsResult.summary ? `${newsResult.summary.length} chars` : 'VAZIO'} | ` +
    `Cutoff: ${new Date(recentCutoff).toISOString()}`
  )
  if (resultsDebug.length > 0) {
    const notFound = resultsDebug.filter((r) => !r.gameFoundInMap).length
    const outWindow = resultsDebug.filter((r) => r.gameFoundInMap && !r.withinWindow && !r.isInFuture).length
    console.log(`[daisy] Results debug — total: ${resultsDebug.length} | not in gameMap: ${notFound} | fora da janela: ${outWindow} | na janela: ${recentResultsCount}`)
  }

  // ── Posts anteriores ─────────────────────────────────────────────────────────
  const previousPostsContext = recentDiaries.length > 0
    ? '\n\nSeus posts anteriores (referência — do mais recente ao mais antigo):\n' +
      recentDiaries.map((d, i) => {
        const excerpt = d.content.replace(/[#*`>\-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 300)
        return `--- Post ${i + 1} (${d.createdAt.slice(0, 10)}) ---\nTítulo: ${d.title}\nSubtítulo: ${d.subtitle}\nExcerto: ${excerpt}…`
      }).join('\n\n') +
      '\n\nEsses posts são apenas referência. Conecte só se houver continuidade natural.'
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

  const recentlyCommentedContext = recentlyCommentedGames.length > 0
    ? '\n\nTemas já abordados recentemente:\n' +
      recentlyCommentedGames.map((g) => `- ${g}`).join('\n') +
      '\n\nEvite reutilizar estes jogos como assunto principal.'
    : ''

  // ── Prompt final ─────────────────────────────────────────────────────────────
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
    recentlyCommentedContext,
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

  const debugBase: Omit<DiaryDebugInfo, 'savedPayload' | 'validationPassed' | 'validationNote'> = {
    model:             AI_MODEL,
    generatedAt,
    cutoffMs:          recentCutoff,
    cutoffLabel:       `${new Date(recentCutoff).toISOString()} (${brtLabel(recentCutoff)})`,
    lastDiaryDate:     recentDiaries[0]?.createdAt,
    gamesRawCount:     allGamesAll.length,
    resultsRawCount:   allResults.length,
    promptsLoadedCount: prompts.length,
    resultsDebug,
    allGamesAnalyzed,
    recentResultEntries,
    olderResultEntries,
    recentlyCommentedGames,
    upcomingGamesDebug,
    newsUrlResults:      newsResult.urlResults,
    newsSummaryPreview:  newsResult.summaryPreview,
    newsSummaryEmpty:    !newsResult.summary.trim(),
    promptsLoaded:       prompts.map((p) => ({
      identifier: p.identifier,
      version:    p.version,
      active:     p.active,
      preview:    p.prompt.slice(0, 300),
    })),
    finalPrompt:   diaryUserMessage,
    rawAIResponse,
  }

  // ── Bloqueio: não salva se IA ignorou resultados recentes ────────────────────
  if (!validationPassed) {
    console.warn(`[daisy] Validation FAILED — ${validationNote}`)
    const debug: DiaryDebugInfo = { ...debugBase, savedPayload: null, validationPassed: false, validationNote }
    return {
      diary: null, saved: false,
      validationError: 'A IA ignorou os resultados recentes. O diário não foi salvo. Revise o debug do contexto.',
      debug, newsResult,
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

  // ── Matérias em featuredMatch ─────────────────────────────────────────────────
  const featuredMatchParts: string[] = []
  if (newsResult.summaryPreview) featuredMatchParts.push(`[Resumo de notícias]\n${newsResult.summaryPreview}`)
  recentResultEntries.forEach((e, i) =>
    featuredMatchParts.push(`[Resultado ${i + 1}] ${e.country1} ${e.result1}×${e.result2} ${e.country2} — ${e.finishedAt}`)
  )
  const featuredMatch = featuredMatchParts.length > 0 ? featuredMatchParts.join('\n\n') : undefined

  const savedPayload = {
    date:           dateStr,
    tytle:          sanitize(diaryJson.title ?? 'Diário da Daisy'),
    subtytle:       sanitize(diaryJson.subtitle ?? ''),
    contentPreview: (diaryJson.content ?? '').slice(0, 500),
    featuredMatch,
  }

  const diary = await createDiary(
    savedPayload.tytle,
    savedPayload.subtytle,
    diaryJson.content ?? '',
    token,
    dateStr,
    featuredMatch,
  )

  const debug: DiaryDebugInfo = { ...debugBase, savedPayload, validationPassed: true, validationNote }

  // ── Palpites — 2 passos, falha não é fatal ────────────────────────────────────
  if (upcomingGames.length > 0 && guessesPrompt) {
    try {
      const gamesCtx = upcomingGames.map((g) =>
        `gameId: ${g._id}, ${countryName(g.country1?._id)} vs ${countryName(g.country2?._id)}`
      ).join('\n')
      const fullResultsCtx = allFinishedForContext.slice(0, 10).join('\n') || 'Nenhum resultado registrado ainda.'

      let analysisContext = ''
      if (matchAnalysisPrompt) {
        try {
          const analysisRaw = await callOpenAI(personaPrompt, [
            matchAnalysisPrompt,
            hasRecentResults
              ? '\n\nResultados recentes:\n' + JSON.stringify(recentResultEntries, null, 2)
              : '\n\nResultados recentes:\n' + (fullResultsCtx || 'Nenhum resultado registrado ainda.'),
            pendingResultContext, newsContext,
            `\n\nJogos para análise:\n${gamesCtx}`,
            '\n\nRetorne APENAS JSON válido: array de objetos com gameId, country1, country2, analysis.',
          ].join(''), { maxTokens: 1024, temperature: 0.5 })

          const analysisArr = parseJsonFromText<{ gameId: string; country1: string; country2: string; analysis: string }[]>(analysisRaw)
          if (Array.isArray(analysisArr) && analysisArr.length > 0) {
            analysisContext = '\n\nAnálise prévia dos jogos:\n' +
              analysisArr.map((a) => `${a.country1} vs ${a.country2}: ${a.analysis}`).join('\n')
          }
        } catch (err) { console.error('[daisy] match analysis failed (non-fatal):', err) }
      }

      const guessRaw = await callOpenAI(personaPrompt, [
        guessesPrompt,
        `\n\nResultados recentes:\n${fullResultsCtx}`,
        pendingResultContext, newsContext, analysisContext,
        `\n\nJogos para as próximas 24h:\n${gamesCtx}`,
        '\n\nRetorne APENAS JSON válido: array de objetos com gameId, result1 e result2.',
      ].join(''), { maxTokens: 512, temperature: 0.7 })

      const guessArr = parseJsonFromText<GuessAIResponse[]>(guessRaw)
      if (Array.isArray(guessArr) && guessArr.length > 0) {
        await saveDaisyGuesses(
          guessArr.map((g) => ({ gameId: g.gameId, result1: clamp(Number(g.result1) || 0), result2: clamp(Number(g.result2) || 0) })),
          token,
        )
      }
    } catch (err) { console.error('[daisy] guess generation failed:', err) }
  }

  return {
    diary, saved: true, debug, newsResult,
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
