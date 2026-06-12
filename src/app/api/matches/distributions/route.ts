import { NextResponse } from 'next/server'
import { sydleCall, parseSearch } from '@/lib/sydle/client'
import { SYDLE_PACKAGE, SYDLE_CLASS, SYDLE_METHOD } from '@/lib/sydle/constants'
import { isGuessingClosed } from '@/lib/utils/dates'
import type { SydleGame, SydleGuess, MatchGuessDistribution } from '@/lib/types'

const BRT_OFFSET_MS = -3 * 60 * 60 * 1000

function parseSydleGameDate(date: number | string | undefined): { matchDate: string; matchTime: string } {
  if (!date) return { matchDate: '', matchTime: '00:00' }
  const d = new Date(typeof date === 'string' ? date : Number(date))
  if (isNaN(d.getTime())) return { matchDate: '', matchTime: '00:00' }
  const brt = new Date(d.getTime() + BRT_OFFSET_MS)
  return {
    matchDate: brt.toISOString().split('T')[0],
    matchTime: brt.toISOString().slice(11, 16),
  }
}

function computeDistribution(guesses: SydleGuess[]): MatchGuessDistribution {
  let country1Wins = 0, draws = 0, country2Wins = 0
  for (const g of guesses) {
    const r1 = g.result1 ?? 0
    const r2 = g.result2 ?? 0
    if (r1 > r2) country1Wins++
    else if (r1 === r2) draws++
    else country2Wins++
  }
  const total = country1Wins + draws + country2Wins
  const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0
  return {
    totalGuesses: total,
    country1Wins,
    draws,
    country2Wins,
    country1WinPercentage: pct(country1Wins),
    drawPercentage: pct(draws),
    country2WinPercentage: pct(country2Wins),
  }
}

function getToken(req: Request): string | null {
  return req.headers.get('Authorization')?.replace('Bearer ', '') ?? null
}

// POST /api/matches/distributions
// Body: { matchIds: string[] }
// Returns: Record<matchId, MatchGuessDistribution> — apenas para jogos fechados
export async function POST(req: Request) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  try {
    const body = await req.json() as { matchIds?: unknown }
    const matchIds = Array.isArray(body.matchIds) ? (body.matchIds as string[]).filter(Boolean) : []
    if (matchIds.length === 0) return NextResponse.json({})

    // Busca os jogos para verificar fechamento server-side (segurança)
    const rawGames = await sydleCall(SYDLE_PACKAGE, SYDLE_CLASS.games, SYDLE_METHOD.search, {
      query: {
        bool: { should: matchIds.map((id) => ({ term: { _id: id } })) },
      },
      size: matchIds.length,
    }, token)

    const games = parseSearch<SydleGame>(rawGames)

    const closedGameIds = games
      .filter((g) => {
        const { matchDate, matchTime } = parseSydleGameDate(g.date)
        return isGuessingClosed(matchDate, matchTime)
      })
      .map((g) => g._id)

    if (closedGameIds.length === 0) return NextResponse.json({})

    // Busca todos os palpites dos jogos fechados em uma única query
    const rawGuesses = await sydleCall(SYDLE_PACKAGE, SYDLE_CLASS.guesses, SYDLE_METHOD.search, {
      query: {
        bool: { should: closedGameIds.map((id) => ({ term: { 'game._id': id } })) },
      },
      size: 2000,
    }, token)

    const guesses = parseSearch<SydleGuess>(rawGuesses)

    // Agrupa palpites por jogo
    const grouped = new Map<string, SydleGuess[]>()
    for (const g of guesses) {
      const gid = g.game?._id ?? ''
      if (!gid) continue
      const arr = grouped.get(gid) ?? []
      arr.push(g)
      grouped.set(gid, arr)
    }

    // Computa distribuição para cada jogo fechado
    const result: Record<string, MatchGuessDistribution> = {}
    for (const id of closedGameIds) {
      result[id] = computeDistribution(grouped.get(id) ?? [])
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[matches/distributions]', err)
    return NextResponse.json({ error: 'Erro ao buscar distribuição.' }, { status: 500 })
  }
}
