import { NextResponse } from 'next/server'
import { generateDailyDiary } from '@/lib/daisy/diaryService'
import type { GenerateDiaryResult } from '@/lib/daisy/types'

const ADMIN_LOGINS = (process.env.ADMIN_LOGINS ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)

function getToken(req: Request): string | null {
  return req.headers.get('Authorization')?.replace('Bearer ', '') ?? null
}

function getLogin(req: Request): string | null {
  return req.headers.get('X-User-Login') ?? null
}

function isAdmin(login: string | null): boolean {
  return !!login && ADMIN_LOGINS.includes(login.toLowerCase())
}

// POST /api/admin/daisy/generate-diary — gera nova entrada do diário via IA
export async function POST(req: Request) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!isAdmin(getLogin(req))) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

  try {
    const result: GenerateDiaryResult = await generateDailyDiary(token)
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    console.error('[admin/daisy/generate-diary]', err)
    const msg = err instanceof Error ? err.message : 'Erro ao gerar diário.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
