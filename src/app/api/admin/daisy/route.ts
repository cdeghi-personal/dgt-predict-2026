import { NextResponse } from 'next/server'
import { getAllDiaries, toggleDiaryActive, deleteDiary } from '@/lib/daisy/diaryRepository'

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

// GET /api/admin/daisy — lista todos os diários (inclusive inativos)
export async function GET(req: Request) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!isAdmin(getLogin(req))) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

  try {
    const diaries = await getAllDiaries(token)
    return NextResponse.json(diaries)
  } catch (err) {
    console.error('[admin/daisy GET]', err)
    return NextResponse.json({ error: 'Erro ao buscar diários.' }, { status: 500 })
  }
}

// DELETE /api/admin/daisy — exclui entrada INATIVA
// Body: { id: string }
export async function DELETE(req: Request) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!isAdmin(getLogin(req))) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

  try {
    const { id } = await req.json() as { id: string }
    if (!id) return NextResponse.json({ error: 'ID obrigatório.' }, { status: 400 })

    // Busca o diário para confirmar que está inativo antes de excluir
    const diaries = await getAllDiaries(token)
    const diary = diaries.find((d) => d.id === id)
    if (!diary) return NextResponse.json({ error: 'Entrada não encontrada.' }, { status: 404 })
    if (diary.active) return NextResponse.json({ error: 'Não é possível excluir uma entrada ativa.' }, { status: 422 })

    await deleteDiary(id, token)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[admin/daisy DELETE]', err)
    return NextResponse.json({ error: 'Erro ao excluir entrada.' }, { status: 500 })
  }
}

// PATCH /api/admin/daisy — alterna status ativo/inativo de uma entrada
// Body: { id: string, active: boolean }
export async function PATCH(req: Request) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!isAdmin(getLogin(req))) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

  try {
    const { id, active } = await req.json() as { id: string; active: boolean }
    if (!id || active == null) return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 })

    await toggleDiaryActive(id, active, token)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[admin/daisy PATCH]', err)
    return NextResponse.json({ error: 'Erro ao atualizar.' }, { status: 500 })
  }
}
