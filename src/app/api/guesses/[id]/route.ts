import { NextResponse } from 'next/server'
import { sydleCall, parseSearch } from '@/lib/sydle/client'
import { SYDLE_PACKAGE, SYDLE_CLASS, SYDLE_METHOD } from '@/lib/sydle/constants'
import type { SydleGame, SydleGuess } from '@/lib/types'

function getToken(req: Request): string | null {
  return req.headers.get('Authorization')?.replace('Bearer ', '') ?? null
}

function matchStarted(game: SydleGame): boolean {
  if (!game.date) return false
  const start = new Date(typeof game.date === 'string' ? game.date : Number(game.date))
  return isNaN(start.getTime()) ? false : new Date() >= start
}

// PUT /api/guesses/[id] — atualizar placar do palpite
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { id } = await params

  try {
    const { result1, result2 } = await req.json()

    if (result1 == null || result2 == null) {
      return NextResponse.json({ error: 'Placar obrigatório.' }, { status: 400 })
    }

    // Resolve o jogo vinculado ao palpite e valida o horário
    const guessRaw = await sydleCall(SYDLE_PACKAGE, SYDLE_CLASS.guesses, SYDLE_METHOD.get, { _id: id }, token).catch(() => null) as SydleGuess | null
    if (guessRaw?.game?._id) {
      const game = await sydleCall(SYDLE_PACKAGE, SYDLE_CLASS.games, SYDLE_METHOD.get, { _id: guessRaw.game._id }, token).catch(() => null) as SydleGame | null
      if (game && matchStarted(game)) {
        return NextResponse.json({ error: 'O prazo para palpitar neste jogo encerrou.' }, { status: 422 })
      }
    }

    const raw = await sydleCall(
      SYDLE_PACKAGE,
      SYDLE_CLASS.guesses,
      SYDLE_METHOD.patch,
      { _id: id, result1: Number(result1), result2: Number(result2) },
      token,
    )

    return NextResponse.json(raw)
  } catch (err) {
    console.error('[guesses PUT]', err)
    return NextResponse.json({ error: 'Erro ao atualizar palpite.' }, { status: 500 })
  }
}
