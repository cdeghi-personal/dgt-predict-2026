import { NextResponse } from 'next/server'
import { sydleCall, parseSearch } from '@/lib/sydle/client'
import { SYDLE_PACKAGE, SYDLE_CLASS, SYDLE_METHOD } from '@/lib/sydle/constants'
import { fetchCountryMap } from '@/lib/sydle/helpers'
import { mapMatch } from '@/lib/mappers'
import type { SydleGame, SydleResult } from '@/lib/types'

function getToken(req: Request): string | null {
  return req.headers.get('Authorization')?.replace('Bearer ', '') ?? null
}

export async function GET(req: Request) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')    // "YYYY-MM-DD"
    const phase = searchParams.get('phase')  // "grupos" | "oitavas" | ...

    // Busca jogos, resultados e países em paralelo (países: tolerante a falha)
    const [rawGames, rawResults, countryMap] = await Promise.all([
      sydleCall(
        SYDLE_PACKAGE,
        SYDLE_CLASS.games,
        SYDLE_METHOD.search,
        { query: { match_all: {} }, size: 200 },
        token,
      ),
      sydleCall(
        SYDLE_PACKAGE,
        SYDLE_CLASS.results,
        SYDLE_METHOD.search,
        { query: { match_all: {} }, size: 500 },
        token,
      ),
      fetchCountryMap(token).catch((e) => {
        console.warn('[matches] paises fetch failed (continuando sem nomes):', e?.message)
        return new Map()
      }),
    ])

    let games = parseSearch<SydleGame>(rawGames)
    const allResults = parseSearch<SydleResult>(rawResults)

    // Mapa gameId → result
    const resultMap = new Map(allResults.map((r) => [r.game?._id, r]))

    // Filtros client-side (date vem como ISO string do SYDLE)
    if (date) {
      games = games.filter((g) => {
        if (!g.date) return false
        const d = new Date(g.date as string)
        return d.toISOString().split('T')[0] === date
      })
    }
    if (phase) {
      games = games.filter((g) => g.phase === phase)
    }

    console.log('[matches] games found:', games.length, '| results:', allResults.length, '| countries:', countryMap.size)
    if (games.length > 0) console.log('[matches] first game sample:', JSON.stringify(games[0]).slice(0, 200))

    const matches = games.map((g) => mapMatch(g, resultMap.get(g._id), countryMap))
    return NextResponse.json(matches)
  } catch (err) {
    console.error('[matches] ERRO:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
