// Server-side only — análise aprofundada dos jogos pela Daisy (etapa intermediária)
// Fluxo: notícias+resumo → analyzeUpcomingMatches → DAISY_DAILY_GUESSES
import { callOpenAI, parseJsonFromText } from './aiClient'
import { mapMatch } from '@/lib/mappers'
import { calculateGroupStandings } from '@/lib/standings'
import type { SydleGame, SydleResult, SydleCountry, Match } from '@/lib/types'
import type { MatchAnalysis } from './types'

interface AnalysisAIResponse {
  gameId: string
  analysis: string
}

export async function analyzeUpcomingMatches(params: {
  upcomingGames: SydleGame[]
  allGames: SydleGame[]
  allResults: SydleResult[]
  countryMap: Map<string, SydleCountry>
  newsContext: string
  matchAnalysisPrompt: string
  personaPrompt: string
}): Promise<MatchAnalysis[]> {
  const {
    upcomingGames,
    allGames,
    allResults,
    countryMap,
    newsContext,
    matchAnalysisPrompt,
    personaPrompt,
  } = params

  if (upcomingGames.length === 0) return []

  const resultMap = new Map(allResults.map((r) => [r.game?._id, r]))
  const allMatches: Match[] = allGames.map((g) => mapMatch(g, resultMap.get(g._id), countryMap))

  const upcomingCtx = upcomingGames.map((g) => {
    const c1 = countryMap.get(g.country1?._id ?? '')
    const c2 = countryMap.get(g.country2?._id ?? '')
    const name1 = c1?.country ?? g.country1?.name ?? '?'
    const name2 = c2?.country ?? g.country2?.name ?? '?'
    const phase = g.phase ?? 'grupos'
    const group = g.group ? ` · Grupo ${g.group}` : ''
    const dateStr = g.date
      ? new Date(typeof g.date === 'string' ? g.date : Number(g.date))
          .toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })
      : ''
    return `gameId:${g._id} | ${name1} vs ${name2} | ${phase}${group}${dateStr ? ` | ${dateStr}` : ''}`
  }).join('\n')

  const userMessage = [
    matchAnalysisPrompt,
    `\n\nJogos para analisar:\n${upcomingCtx}`,
    `\n\nResultados recentes:\n${buildRecentResultsContext(allMatches)}`,
    `\n\nClassificação dos grupos:\n${buildStandingsContext(allMatches)}`,
    newsContext,
    '\n\nRetorne APENAS JSON válido: array de objetos com { gameId (string), analysis (string em português, 2 a 3 frases descrevendo o contexto e perspectivas do jogo) }.',
  ].join('')

  const raw = await callOpenAI(personaPrompt, userMessage, { maxTokens: 1500, temperature: 0.6 })
  const aiAnalyses = parseJsonFromText<AnalysisAIResponse[]>(raw)

  if (!Array.isArray(aiAnalyses)) return []

  return aiAnalyses.flatMap((a) => {
    const game = upcomingGames.find((g) => g._id === a.gameId)
    if (!game) return []
    const c1 = countryMap.get(game.country1?._id ?? '')
    const c2 = countryMap.get(game.country2?._id ?? '')
    return [{
      gameId: a.gameId,
      country1: c1?.country ?? game.country1?.name ?? '?',
      country2: c2?.country ?? game.country2?.name ?? '?',
      analysis: String(a.analysis ?? '').trim().slice(0, 500),
    }]
  })
}

function buildRecentResultsContext(matches: Match[]): string {
  const finished = matches
    .filter((m) => m.status === 'FINISHED' && m.scoreCountry1 != null)
    .sort((a, b) => b.matchDate.localeCompare(a.matchDate))
    .slice(0, 10)
  if (finished.length === 0) return 'Nenhum resultado ainda.'
  return finished
    .map((m) =>
      `${m.country1.name} ${m.scoreCountry1} × ${m.scoreCountry2} ${m.country2.name}` +
      ` (${m.phase}${m.group ? ` Grp ${m.group}` : ''})`,
    )
    .join('\n')
}

function buildStandingsContext(matches: Match[]): string {
  const byGroup = calculateGroupStandings(matches)
  if (byGroup.size === 0) return 'Fase de grupos ainda sem dados.'
  const lines: string[] = []
  for (const [group, teams] of byGroup) {
    lines.push(`Grupo ${group}:`)
    for (const t of teams) {
      lines.push(
        `  ${t.team.name}: ${t.PG}pts | ${t.J}J ${t.V}V ${t.E}E ${t.D}D` +
        ` | SG:${t.SG >= 0 ? '+' : ''}${t.SG}`,
      )
    }
  }
  return lines.join('\n')
}
