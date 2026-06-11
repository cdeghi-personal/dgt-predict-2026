import { NextResponse } from 'next/server'
import { sydleCall, parseSearch } from '@/lib/sydle/client'
import { SYDLE_PACKAGE, SYDLE_CLASS, SYDLE_METHOD } from '@/lib/sydle/constants'
import { mapCountry } from '@/lib/mappers'
import type { SydleCountry } from '@/lib/types'

function getToken(req: Request): string | null {
  return req.headers.get('Authorization')?.replace('Bearer ', '') ?? null
}

export async function GET(req: Request) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  try {
    const raw = await sydleCall(
      SYDLE_PACKAGE,
      SYDLE_CLASS.countries,
      SYDLE_METHOD.search,
      { query: { match_all: {} }, sort: [{ country: { order: 'asc' } }], size: 100 },
      token,
    )

    const countries = parseSearch<SydleCountry>(raw).map(mapCountry)
    return NextResponse.json(countries)
  } catch (err) {
    console.error('[countries]', err)
    return NextResponse.json({ error: 'Erro ao buscar países.' }, { status: 500 })
  }
}
