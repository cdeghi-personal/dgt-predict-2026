/**
 * Cliente SYDLE ONE — padrão baseado no CLAUDE.md do performance-management-dgt.
 *
 * - Auth: GET /sys/auth/signIn com Basic base64(login:senha)
 * - Business: POST /<pacote>/<classe>/<metodo> com Bearer token
 * - Headers obrigatórios: Authorization + X-Explorer-Account-Token
 * - Respostas de busca: formato Elasticsearch (hits.hits[i]._source)
 */

import { SYDLE_BASE_URL, SYDLE_ORG } from './constants'
import type { SydleAuthResponse, SydleSearchResponse } from '../types'

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function sydleSignIn(login: string, password: string): Promise<SydleAuthResponse> {
  const credentials = Buffer.from(`${login}:${password}`).toString('base64')
  const url = `${SYDLE_BASE_URL}/sys/auth/signIn`

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${credentials}`,
      'X-Explorer-Account-Token': SYDLE_ORG,
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new SydleAuthError(`Login falhou (${res.status})${text ? ': ' + text : ''}`)
  }

  return res.json()
}

// ─── Business calls ───────────────────────────────────────────────────────────

export async function sydleCall<T = unknown>(
  pkg: string,
  className: string,
  method: string,
  body: Record<string, unknown> | null,
  token: string,
): Promise<T> {
  const url = `${SYDLE_BASE_URL}/${pkg}/${className}/${method}`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Explorer-Account-Token': SYDLE_ORG,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : '{}',
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new SydleError(`SYDLE ${pkg}/${className}/${method} falhou (${res.status})${text ? ': ' + text : ''}`)
  }

  return res.json()
}

// ─── Search helper ────────────────────────────────────────────────────────────

export function parseSearch<T>(raw: unknown): T[] {
  const data = raw as SydleSearchResponse<T>
  return data?.hits?.hits?.map((h) => ({ ...h._source, _id: h._id ?? (h._source as Record<string, unknown>)._id })) ?? []
}

export function parseSearchFirst<T>(raw: unknown): T | null {
  const items = parseSearch<T>(raw)
  return items[0] ?? null
}

// ─── Errors ───────────────────────────────────────────────────────────────────

export class SydleError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SydleError'
  }
}

export class SydleAuthError extends SydleError {
  constructor(message: string) {
    super(message)
    this.name = 'SydleAuthError'
  }
}
