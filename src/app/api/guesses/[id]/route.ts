import { NextResponse } from 'next/server'
import { sydleCall, parseSearchFirst } from '@/lib/sydle/client'
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

    // Busca o palpite atual para montar o _update completo
    const guessRaw = await sydleCall(SYDLE_PACKAGE, SYDLE_CLASS.guesses, SYDLE_METHOD.search, {
      query: { term: { _id: id } }, size: 1,
    }, token).then((r) => parseSearchFirst<SydleGuess>(r)).catch(() => null)

    if (!guessRaw) {
      return NextResponse.json({ error: 'Palpite não encontrado.' }, { status: 404 })
    }

    // Valida se o jogo já começou
    if (guessRaw.game?._id) {
      const game = await sydleCall(SYDLE_PACKAGE, SYDLE_CLASS.games, SYDLE_METHOD.search, {
        query: { term: { _id: guessRaw.game._id } }, size: 1,
      }, token).then((r) => parseSearchFirst<SydleGame>(r)).catch(() => null)
      if (game && matchStarted(game)) {
        return NextResponse.json({ error: 'O prazo para palpitar neste jogo encerrou.' }, { status: 422 })
      }
    }

    // _update com objeto completo — mais confiável que _patch
    const raw = await sydleCall(
      SYDLE_PACKAGE,
      SYDLE_CLASS.guesses,
      SYDLE_METHOD.update,
      {
        _id: id,
        user: guessRaw.user ? { _id: guessRaw.user._id } : undefined,
        game: { _id: guessRaw.game._id },
        result1: Number(result1),
        result2: Number(result2),
      },
      token,
    )

    return NextResponse.json(raw)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[guesses PUT]', msg)
    return NextResponse.json({ error: 'Erro ao atualizar palpite.' }, { status: 500 })
  }
}
