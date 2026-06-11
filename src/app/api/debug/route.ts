import { NextResponse } from 'next/server'

const SYDLE_ORG = process.env.SYDLE_ORG ?? ''
const SYDLE_APP = process.env.SYDLE_APP ?? 'dgtPredict'
const SYDLE_PACKAGE = process.env.SYDLE_PACKAGE ?? 'predict2026'
const BASE_URL = `https://${SYDLE_ORG}.sydle.one/api/1/${SYDLE_APP}`

function getToken(req: Request): string | null {
  return req.headers.get('Authorization')?.replace('Bearer ', '') ?? null
}

export async function GET(req: Request) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Sem token. Faça login primeiro.' }, { status: 401 })

  const url = `${BASE_URL}/${SYDLE_PACKAGE}/game/_search`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Explorer-Account-Token': SYDLE_ORG,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: { match_all: {} }, size: 5 }),
      cache: 'no-store',
    })

    const status = res.status
    const text = await res.text()
    let parsed: unknown = null
    try { parsed = JSON.parse(text) } catch { /* raw text */ }

    return NextResponse.json({
      url,
      status,
      ok: res.ok,
      raw: parsed ?? text,
      envVars: { SYDLE_ORG, SYDLE_APP, SYDLE_PACKAGE },
    })
  } catch (err) {
    return NextResponse.json({ error: String(err), url, envVars: { SYDLE_ORG, SYDLE_APP, SYDLE_PACKAGE } }, { status: 500 })
  }
}
