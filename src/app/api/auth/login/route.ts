import { NextResponse } from 'next/server'
import { sydleSignIn, SydleAuthError } from '@/lib/sydle/client'

const ADMIN_LOGINS = (process.env.ADMIN_LOGINS ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)

export async function POST(req: Request) {
  try {
    const { login, password } = await req.json()

    if (!login || !password) {
      return NextResponse.json({ error: 'Login e senha são obrigatórios.' }, { status: 400 })
    }

    const sydle = await sydleSignIn(login, password)

    const user = {
      id: sydle.code,
      name: sydle.name,
      login: sydle.login,
      token: sydle.accessToken.token,
      tokenExp: sydle.accessToken.payload.exp,
      isAdmin: ADMIN_LOGINS.includes(sydle.login.toLowerCase()),
    }

    return NextResponse.json(user)
  } catch (err) {
    if (err instanceof SydleAuthError) {
      return NextResponse.json({ error: 'Usuário ou senha incorretos.' }, { status: 401 })
    }
    console.error('[auth/login]', err)
    return NextResponse.json({ error: 'Erro interno. Tente novamente.' }, { status: 500 })
  }
}
