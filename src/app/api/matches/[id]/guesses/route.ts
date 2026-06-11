import { NextResponse } from 'next/server'
import { sydleCall, parseSearchFirst, parseSearch } from '@/lib/sydle/client'
import { SYDLE_PACKAGE, SYDLE_CLASS, SYDLE_METHOD } from '@/lib/sydle/constants'
import { fetchCountryMap } from '@/lib/sydle/helpers'
import { isGuessingClosed } from '@/lib/utils/dates'
import { calculatePoints } from '@/lib/utils/scoring'
import { mapMatch } from '@/lib/mappers'
import { DAISY_USER_ID } from '@/lib/daisy/constants'
import type { SydleGame, SydleGuess, SydleResult } from '@/lib/types'

export type GuessOutcome = 'EXACT_SCORE' | 'CORRECT_RESULT' | 'WRONG' | 'PENDING'

export type MatchGuessParticipant = {
  guessId: string
  userId: string
  userName: string
  isDaisy: boolean
  result1: number
  result2: number
  points: number | null
  outcome: GuessOutcome
  createdAt: string
}

export type MatchGuessesResponse = {
  matchId: string
  isFinished: boolean
  totalGuesses: number
  exactScores: number
  correctResults: number
  wrong: number
  participants: MatchGuessParticipant[]
}

function getToken(req: Request): string | null {
  return req.headers.get('Authorization')?.replace('Bearer ', '') ?? null
}

const BRT_OFFSET_MS = -3 * 60 * 60 * 1000

/** Extrai "YYYY-MM-DD" e "HH:MM" em horário de Brasília (UTC-3) */
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

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { id } = await params

  try {
    const [rawGame, countryMap] = await Promise.all([
      sydleCall(SYDLE_PACKAGE, SYDLE_CLASS.games, SYDLE_METHOD.search, {
        query: { term: { _id: id } }, size: 1,
      }, token),
      fetchCountryMap(token).catch(() => new Map()),
    ])

    const game = parseSearchFirst<SydleGame>(rawGame)
    if (!game) return NextResponse.json({ error: 'Partida não encontrada.' }, { status: 404 })

    // ── Segurança: só revelar palpites após fechamento ────────────────────────
    const { matchDate, matchTime } = parseSydleGameDate(game.date)
    if (!isGuessingClosed(matchDate, matchTime)) {
      return NextResponse.json(
        { error: 'Os palpites deste jogo ainda estão protegidos e serão liberados após o fechamento.' },
        { status: 403 },
      )
    }

    // ── Busca palpites + resultado em paralelo ────────────────────────────────
    const [rawGuesses, rawResult] = await Promise.all([
      sydleCall(SYDLE_PACKAGE, SYDLE_CLASS.guesses, SYDLE_METHOD.search, {
        query: { term: { 'game._id': id } },
        sort: [{ _creationDate: { order: 'asc' } }],
        size: 500,
      }, token),
      sydleCall(SYDLE_PACKAGE, SYDLE_CLASS.results, SYDLE_METHOD.search, {
        query: { term: { 'game._id': id } }, size: 1,
      }, token),
    ])

    const guesses  = parseSearch<SydleGuess>(rawGuesses)
    const result   = parseSearchFirst<SydleResult>(rawResult) ?? null
    const match    = mapMatch(game, result, countryMap)
    const finished = match.status === 'FINISHED'
    const score1   = match.scoreCountry1
    const score2   = match.scoreCountry2

    const participants: MatchGuessParticipant[] = guesses.map((g) => {
      const userId  = g.user?._id ?? ''
      const isDaisy = userId === DAISY_USER_ID
      const userName = isDaisy
        ? 'Daisy'
        : (g.user?.name ?? g.user?.login ?? 'Usuário')

      let points: number | null = null
      let outcome: GuessOutcome = 'PENDING'

      if (finished && score1 != null && score2 != null) {
        const calc = calculatePoints(g.result1 ?? 0, g.result2 ?? 0, score1, score2)
        points  = calc.points
        outcome = calc.outcome === 'EXACT'   ? 'EXACT_SCORE'
                : calc.outcome === 'CORRECT' ? 'CORRECT_RESULT'
                : 'WRONG'
      }

      const ts = g._creationDate
      return {
        guessId:   g._id,
        userId,
        userName,
        isDaisy,
        result1:   g.result1 ?? 0,
        result2:   g.result2 ?? 0,
        points,
        outcome,
        createdAt: ts
          ? new Date(typeof ts === 'number' ? ts : Number(ts)).toISOString()
          : new Date().toISOString(),
      }
    })

    // Ordenação: finalizado → pontos desc → nome; pendente → nome asc
    participants.sort((a, b) => {
      if (finished) {
        const diff = (b.points ?? -1) - (a.points ?? -1)
        if (diff !== 0) return diff
      }
      return a.userName.localeCompare(b.userName, 'pt-BR')
    })

    const exactScores    = participants.filter((p) => p.outcome === 'EXACT_SCORE').length
    const correctResults = participants.filter((p) => p.outcome === 'CORRECT_RESULT').length
    const wrong          = participants.filter((p) => p.outcome === 'WRONG').length

    const response: MatchGuessesResponse = {
      matchId: id,
      isFinished: finished,
      totalGuesses: participants.length,
      exactScores,
      correctResults,
      wrong,
      participants,
    }

    return NextResponse.json(response)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[matches/[id]/guesses]', msg)
    return NextResponse.json({ error: `Erro ao buscar palpites: ${msg}` }, { status: 500 })
  }
}
