import { NextResponse } from 'next/server'
import { sydleCall, parseSearchFirst } from '@/lib/sydle/client'
import { SYDLE_PACKAGE, SYDLE_CLASS, SYDLE_METHOD } from '@/lib/sydle/constants'
import { fetchCountryMap } from '@/lib/sydle/helpers'
import { mapMatch } from '@/lib/mappers'
import type { SydleGame, SydleResult } from '@/lib/types'

function getToken(req: Request): string | null {
  return req.headers.get('Authorization')?.replace('Bearer ', '') ?? null
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { id } = await params

  try {
    const [rawGame, rawResult, countryMapRaw] = await Promise.all([
      sydleCall(
        SYDLE_PACKAGE,
        SYDLE_CLASS.games,
        SYDLE_METHOD.search,
        { query: { term: { _id: id } }, size: 1 },
        token,
      ),
      sydleCall(
        SYDLE_PACKAGE,
        SYDLE_CLASS.results,
        SYDLE_METHOD.search,
        { query: { term: { 'game._id': id } }, size: 1 },
        token,
      ),
      fetchCountryMap(token).catch(() => new Map()),
    ])

    const game = parseSearchFirst<SydleGame>(rawGame)
    if (!game) return NextResponse.json({ error: 'Partida não encontrada.' }, { status: 404 })

    const result = parseSearchFirst<SydleResult>(rawResult) ?? null
    return NextResponse.json(mapMatch(game, result, countryMapRaw))
  } catch (err) {
    console.error('[matches/[id]]', err)
    return NextResponse.json({ error: 'Erro ao buscar partida.' }, { status: 500 })
  }
}
