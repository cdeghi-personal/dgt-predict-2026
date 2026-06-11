import { NextResponse } from 'next/server'
import { getDiaryById } from '@/lib/daisy/diaryRepository'

function getToken(req: Request): string | null {
  return req.headers.get('Authorization')?.replace('Bearer ', '') ?? null
}

// GET /api/daisy/diary/[id]
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { id } = await params

  try {
    const diary = await getDiaryById(id, token)
    if (!diary) return NextResponse.json({ error: 'Entrada não encontrada.' }, { status: 404 })
    return NextResponse.json(diary)
  } catch (err) {
    console.error('[daisy/diary/[id] GET]', err)
    return NextResponse.json({ error: 'Erro ao buscar entrada.' }, { status: 500 })
  }
}
