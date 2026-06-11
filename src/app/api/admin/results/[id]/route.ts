import { NextResponse } from 'next/server'
import { sydleCall } from '@/lib/sydle/client'
import { SYDLE_PACKAGE, SYDLE_CLASS, SYDLE_METHOD } from '@/lib/sydle/constants'

const ADMIN_LOGINS = (process.env.ADMIN_LOGINS ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)

function getToken(req: Request) { return req.headers.get('Authorization')?.replace('Bearer ', '') ?? null }
function getLogin(req: Request) { return req.headers.get('X-User-Login') ?? null }
function isAdmin(login: string | null) { return !!login && ADMIN_LOGINS.includes(login.toLowerCase()) }

// PATCH — atualizar resultado existente
// [id] = results._id (resultId, NÃO o gameId)
// Body: { result1: number, result2: number }
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!isAdmin(getLogin(req))) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

  const { id } = await params

  try {
    const { result1, result2 } = await req.json()

    if (result1 == null || result2 == null) {
      return NextResponse.json({ error: 'Placar obrigatório.' }, { status: 400 })
    }

    const raw = await sydleCall(
      SYDLE_PACKAGE,
      SYDLE_CLASS.results,
      SYDLE_METHOD.patch,
      { _id: id, result1: Number(result1), result2: Number(result2) },
      token,
    )

    return NextResponse.json(raw)
  } catch (err) {
    console.error('[admin/results PATCH]', err)
    return NextResponse.json({ error: 'Erro ao atualizar resultado.' }, { status: 500 })
  }
}
