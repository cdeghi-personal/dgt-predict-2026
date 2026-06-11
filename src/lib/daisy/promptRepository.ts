// Server-side only
import { sydleCall, parseSearch } from '@/lib/sydle/client'
import { DAISY_PACKAGE, SYDLE_CLASS, SYDLE_METHOD } from '@/lib/sydle/constants'
import type { SydleDaisyPrompt } from '@/lib/types'

export async function getAllPrompts(token: string): Promise<SydleDaisyPrompt[]> {
  const raw = await sydleCall(
    DAISY_PACKAGE,
    SYDLE_CLASS.daisyPrompt,
    SYDLE_METHOD.search,
    { query: { term: { Active: true } }, size: 50 },
    token,
  )
  return parseSearch<SydleDaisyPrompt>(raw)
}

export async function getPromptByIdentifier(
  identifier: string,
  token: string,
): Promise<SydleDaisyPrompt | null> {
  const raw = await sydleCall(
    DAISY_PACKAGE,
    SYDLE_CLASS.daisyPrompt,
    SYDLE_METHOD.search,
    { query: { term: { identifier } }, size: 1 },
    token,
  )
  const items = parseSearch<SydleDaisyPrompt>(raw)
  return items[0] ?? null
}
