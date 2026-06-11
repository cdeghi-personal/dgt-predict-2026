import { NextResponse } from 'next/server'
import { callOpenAI } from '@/lib/daisy/aiClient'
import type { DaisyAITestResult } from '@/lib/daisy/types'

const ADMIN_LOGINS = (process.env.ADMIN_LOGINS ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)

function getLogin(req: Request): string | null {
  return req.headers.get('X-User-Login') ?? null
}

function isAdmin(login: string | null): boolean {
  return !!login && ADMIN_LOGINS.includes(login.toLowerCase())
}

const TEST_PROMPT = 'Você é Daisy, consultora virtual da DGT no DGT Predict 2026. Responda em uma única frase curta, simpática e bem-humorada, apresentando-se para os participantes do bolão.'

// POST /api/admin/daisy/test-ai — testa conexão com OpenAI (sem criar diário)
export async function POST(req: Request) {
  if (!isAdmin(getLogin(req))) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  if (!process.env.OPENAI_API_KEY) {
    const result: DaisyAITestResult = {
      success: false,
      provider: 'OpenAI',
      model: 'gpt-4.1',
      error: 'OPENAI_API_KEY não configurada no ambiente.',
    }
    return NextResponse.json(result, { status: 500 })
  }

  try {
    const message = await callOpenAI(
      'Você é Daisy, assistente virtual da DGT Consultoria.',
      TEST_PROMPT,
      { maxTokens: 150, temperature: 0.8 },
    )

    const result: DaisyAITestResult = {
      success: true,
      provider: 'OpenAI',
      model: 'gpt-4.1',
      message,
    }
    return NextResponse.json(result)
  } catch (err) {
    console.error('[admin/daisy/test-ai]', err)
    const result: DaisyAITestResult = {
      success: false,
      provider: 'OpenAI',
      model: 'gpt-4.1',
      error: err instanceof Error ? err.message : 'Erro desconhecido.',
    }
    return NextResponse.json(result, { status: 500 })
  }
}
