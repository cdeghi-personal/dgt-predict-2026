import { NextResponse } from 'next/server'
import { getActiveDiaries } from '@/lib/daisy/diaryRepository'

function getToken(req: Request): string | null {
  return req.headers.get('Authorization')?.replace('Bearer ', '') ?? null
}

// GET /api/daisy/diary — lista entradas ativas do diário (pública para usuários autenticados)
export async function GET(req: Request) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  try {
    const diaries = await getActiveDiaries(token)
    return NextResponse.json(diaries)
  } catch (err) {
    console.error('[daisy/diary GET]', err)
    return NextResponse.json({ error: 'Erro ao buscar diário.' }, { status: 500 })
  }
}
