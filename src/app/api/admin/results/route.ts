import { NextResponse } from 'next/server'
import { sydleCall, parseSearch } from '@/lib/sydle/client'
import { SYDLE_PACKAGE, SYDLE_CLASS, SYDLE_METHOD } from '@/lib/sydle/constants'
import { fetchCountryMap } from '@/lib/sydle/helpers'
import { mapMatch } from '@/lib/mappers'
import type { SydleGame, SydleResult } from '@/lib/types'

const ADMIN_LOGINS = (process.env.ADMIN_LOGINS ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)

function getToken(req: Request): string | null {
  return req.headers.get('Authorization')?.replace('Bearer ', '') ?? null
}

function getLogin(req: Request): string | null {
  return req.headers.get('X-User-Login') ?? null
}

function isAdmin(login: string | null): boolean {
  return !!login && ADMIN_LOGINS.includes(login.toLowerCase())
}

// GET — lista todos os jogos (com e sem resultado) como Match[]
export async function GET(req: Request) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!isAdmin(getLogin(req))) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

  try {
    const [rawGames, rawResults, countryMap] = await Promise.all([
      sydleCall(
        SYDLE_PACKAGE,
        SYDLE_CLASS.games,
        SYDLE_METHOD.search,
        { query: { match_all: {} }, sort: [{ date: { order: 'asc' } }], size: 500 },
        token,
      ),
      sydleCall(
        SYDLE_PACKAGE,
        SYDLE_CLASS.results,
        SYDLE_METHOD.search,
        { query: { match_all: {} }, size: 500 },
        token,
      ),
      fetchCountryMap(token),
    ])

    const games = parseSearch<SydleGame>(rawGames)
    const resultMap = new Map(parseSearch<SydleResult>(rawResults).map((r) => [r.game?._id, r]))

    const matches = games.map((g) => mapMatch(g, resultMap.get(g._id), countryMap))
    return NextResponse.json(matches)
  } catch (err) {
    console.error('[admin/results GET]', err)
    return NextResponse.json({ error: 'Erro ao buscar partidas.' }, { status: 500 })
  }
}

// POST — registrar resultado de um jogo
// Body: { gameId: string, result1: number, result2: number }
export async function POST(req: Request) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!isAdmin(getLogin(req))) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

  try {
    const body = await req.json()
    const { gameId, result1, result2 } = body

    if (!gameId || result1 == null || result2 == null) {
      return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 })
    }

    const raw = await sydleCall(
      SYDLE_PACKAGE,
      SYDLE_CLASS.results,
      SYDLE_METHOD.create,
      {
        game: { _id: gameId },
        result1: Number(result1),
        result2: Number(result2),
      },
      token,
    )

    return NextResponse.json(raw, { status: 201 })
  } catch (err) {
    console.error('[admin/results POST]', err)
    return NextResponse.json({ error: 'Erro ao registrar resultado.' }, { status: 500 })
  }
}
