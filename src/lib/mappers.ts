import { countryNameToIso } from './countryFlags'
import type {
  SydleCountry, Country,
  SydleGame, SydleResult, Match,
  SydleGuess, Guess,
} from './types'

export function mapCountry(raw: SydleCountry): Country {
  const name = raw.country ?? ''
  return {
    id: raw._id,
    name,
    flag: countryNameToIso(name),
  }
}

/**
 * Converte o campo date do SYDLE para { date, time }.
 * Aceita ISO string ("2026-06-11T19:00Z") ou timestamp numérico (ms).
 */
function parseSydleDate(ts: number | string | null | undefined): { date: string; time: string } {
  if (!ts) return { date: '', time: '00:00' }
  const d = new Date(typeof ts === 'string' ? ts : Number(ts))
  if (isNaN(d.getTime())) return { date: '', time: '00:00' }
  return {
    date: d.toISOString().split('T')[0],  // "YYYY-MM-DD"
    time: d.toISOString().slice(11, 16),  // "HH:MM" UTC
  }
}

/**
 * Monta um Match a partir de SydleGame + SydleResult opcional.
 * countryMap: Map<_id, SydleCountry> — fornecido pelas rotas de API
 * para resolver nome e bandeira (a referência SYDLE só retorna _id).
 */
export function mapMatch(
  game: SydleGame,
  result?: SydleResult | null,
  countryMap?: Map<string, SydleCountry>,
): Match {
  const { date, time } = parseSydleDate(game.date)

  const c1 = countryMap?.get(game.country1?._id ?? '')
  const c2 = countryMap?.get(game.country2?._id ?? '')

  const name1 = c1?.country ?? game.country1?.country ?? game.country1?.name ?? ''
  const name2 = c2?.country ?? game.country2?.country ?? game.country2?.name ?? ''

  return {
    id: game._id,
    resultId: result?._id ?? null,
    country1: {
      id: game.country1?._id ?? '',
      name: name1,
      flag: countryNameToIso(name1),
    },
    country2: {
      id: game.country2?._id ?? '',
      name: name2,
      flag: countryNameToIso(name2),
    },
    matchDate: date,
    matchTime: time,
    city: game.city ?? '',
    group: game.group ?? '',
    phase: game.phase ?? 'grupos',
    status: result ? 'FINISHED' : 'SCHEDULED',
    scoreCountry1: result?.result1 ?? null,
    scoreCountry2: result?.result2 ?? null,
  }
}

export function mapGuess(raw: SydleGuess): Guess {
  return {
    id: raw._id,
    userId: raw.user?._id ?? '',
    userName: raw.user?.name ?? raw.user?.login ?? '',
    matchId: raw.game?._id ?? '',   // game._id é o ID da partida
    result1: raw.result1 ?? 0,
    result2: raw.result2 ?? 0,
    points: null,  // calculado em runtime em /api/ranking; não armazenado no SYDLE
  }
}
