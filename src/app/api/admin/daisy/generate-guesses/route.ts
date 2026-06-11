import { NextResponse } from 'next/server'
import { generateAndSaveDaisyGuesses } from '@/lib/daisy/guessGenerationService'

function getToken(req: Request): string | null {
  return req.headers.get('Authorization')?.replace('Bearer ', '') ?? null
}

export async function POST(req: Request) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  try {
    const result = await generateAndSaveDaisyGuesses(token)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[generate-guesses]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao gerar palpites.' },
      { status: 500 },
    )
  }
}
