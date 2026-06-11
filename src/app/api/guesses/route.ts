import { NextResponse } from 'next/server'
import { sydleCall, parseSearch, parseSearchFirst } from '@/lib/sydle/client'
import { SYDLE_PACKAGE, SYDLE_CLASS, SYDLE_METHOD } from '@/lib/sydle/constants'
import { mapGuess } from '@/lib/mappers'
import type { SydleGuess, SydleGame } from '@/lib/types'

/** Retorna true se o horário de início do jogo já passou (UTC). */
function matchStarted(game: SydleGame): boolean {
  if (!game.date) return false
  const start = new Date(typeof game.date === 'string' ? game.date : Number(game.date))
  return isNaN(start.getTime()) ? false : new Date() >= start
}

function getToken(req: Request): string | null {
  return req.headers.get('Authorization')?.replace('Bearer ', '') ?? null
}

// GET /api/guesses?userId=xxx
// GET /api/guesses?matchId=xxx  (matchId = game._id)
export async function GET(req: Request) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  const matchId = searchParams.get('matchId')

  const must: unknown[] = []
  if (userId) must.push({ term: { 'user._id': userId } })
  if (matchId) must.push({ term: { 'game._id': matchId } })

  const query = must.length > 0 ? { bool: { must } } : { match_all: {} }

  try {
    const raw = await sydleCall(
      SYDLE_PACKAGE,
      SYDLE_CLASS.guesses,
      SYDLE_METHOD.search,
      { query, sort: [{ _creationDate: { order: 'desc' } }], size: 500 },
      token,
    )

    const guesses = parseSearch<SydleGuess>(raw).map(mapGuess)
    return NextResponse.json(guesses)
  } catch (err) {
    console.error('[guesses GET]', err)
    return NextResponse.json({ error: 'Erro ao buscar palpites.' }, { status: 500 })
  }
}

// POST /api/guesses — criar palpite
// Body: { userId, matchId, result1, result2 }
export async function POST(req: Request) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  try {
    const body = await req.json()
    const { userId, matchId, result1, result2 } = body

    if (!userId || !matchId || result1 == null || result2 == null) {
      return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 })
    }

    // Valida que o jogo existe e ainda não começou
    const game = await sydleCall(SYDLE_PACKAGE, SYDLE_CLASS.games, SYDLE_METHOD.search, {
      query: { term: { _id: matchId } }, size: 1,
    }, token).then((r) => parseSearchFirst<SydleGame>(r)).catch(() => null)
    if (!game) {
      return NextResponse.json({ error: 'Jogo não encontrado.' }, { status: 404 })
    }
    if (matchStarted(game)) {
      return NextResponse.json({ error: 'O prazo para palpitar neste jogo encerrou.' }, { status: 422 })
    }

    const raw = await sydleCall(
      SYDLE_PACKAGE,
      SYDLE_CLASS.guesses,
      SYDLE_METHOD.create,
      {
        user: { _id: userId },
        game: { _id: matchId },
        result1: Number(result1),
        result2: Number(result2),
      },
      token,
    )

    return NextResponse.json(raw, { status: 201 })
  } catch (err) {
    console.error('[guesses POST]', err)
    return NextResponse.json({ error: 'Erro ao criar palpite.' }, { status: 500 })
  }
}
