import { NextResponse } from 'next/server'
import { sydleCall, parseSearch } from '@/lib/sydle/client'
import { SYDLE_PACKAGE, SYDLE_CLASS, SYDLE_METHOD } from '@/lib/sydle/constants'
import { mapGuess } from '@/lib/mappers'
import { calculatePoints } from '@/lib/utils/scoring'
import type { SydleGuess, SydleResult, RankingEntry } from '@/lib/types'

function getToken(req: Request): string | null {
  return req.headers.get('Authorization')?.replace('Bearer ', '') ?? null
}

export async function GET(req: Request) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  try {
    // Resultados registrados e palpites em paralelo
    const [rawResults, rawGuesses] = await Promise.all([
      sydleCall(
        SYDLE_PACKAGE,
        SYDLE_CLASS.results,
        SYDLE_METHOD.search,
        { query: { match_all: {} }, size: 500 },
        token,
      ),
      sydleCall(
        SYDLE_PACKAGE,
        SYDLE_CLASS.guesses,
        SYDLE_METHOD.search,
        { query: { match_all: {} }, size: 2000 },
        token,
      ),
    ])

    const allResults = parseSearch<SydleResult>(rawResults)
    const guesses = parseSearch<SydleGuess>(rawGuesses).map(mapGuess)

    // Mapa gameId → result para lookup rápido
    const resultMap = new Map(allResults.map((r) => [r.game?._id, r]))

    // Acumula pontos por usuário
    const userMap = new Map<string, { name: string; points: number; exact: number; correct: number }>()

    for (const guess of guesses) {
      const result = resultMap.get(guess.matchId)
      if (!result) continue  // jogo sem resultado = não conta para ranking ainda

      const { points, outcome } = calculatePoints(
        guess.result1,
        guess.result2,
        result.result1,
        result.result2,
      )

      const existing = userMap.get(guess.userId) ?? { name: guess.userName, points: 0, exact: 0, correct: 0 }
      existing.points += points
      if (outcome === 'EXACT') existing.exact++
      if (outcome === 'CORRECT') existing.correct++
      userMap.set(guess.userId, existing)
    }

    // Constrói ranking com critérios de desempate
    const entries: RankingEntry[] = Array.from(userMap.entries()).map(([id, data]) => ({
      userId: id,
      userName: data.name,
      totalPoints: data.points,
      exactScores: data.exact,
      correctResults: data.correct,
      position: 0,
    }))

    entries.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
      if (b.exactScores !== a.exactScores) return b.exactScores - a.exactScores
      if (b.correctResults !== a.correctResults) return b.correctResults - a.correctResults
      return a.userName.localeCompare(b.userName)
    })

    entries.forEach((e, i) => { e.position = i + 1 })

    return NextResponse.json(entries)
  } catch (err) {
    console.error('[ranking]', err)
    return NextResponse.json({ error: 'Erro ao calcular ranking.' }, { status: 500 })
  }
}
