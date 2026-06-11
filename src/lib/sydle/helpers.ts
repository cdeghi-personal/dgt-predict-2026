import { sydleCall, parseSearch } from './client'
import { SYDLE_PACKAGE, SYDLE_CLASS, SYDLE_METHOD } from './constants'
import type { SydleCountry } from '../types'

/** Busca todos os países e retorna mapa _id → SydleCountry */
export async function fetchCountryMap(token: string): Promise<Map<string, SydleCountry>> {
  const raw = await sydleCall(
    SYDLE_PACKAGE,
    SYDLE_CLASS.countries,
    SYDLE_METHOD.search,
    { query: { match_all: {} }, size: 300 },
    token,
  )
  const countries = parseSearch<SydleCountry>(raw)
  return new Map(countries.map((c) => [c._id, c]))
}
