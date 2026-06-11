// Server-side only
import { sydleCall, parseSearch } from '@/lib/sydle/client'
import { DAISY_PACKAGE, SYDLE_CLASS, SYDLE_METHOD } from '@/lib/sydle/constants'
import type { SydleDaisyPrompt } from '@/lib/types'
import type { DaisyPrompt } from './types'

function mapPrompt(raw: SydleDaisyPrompt): DaisyPrompt {
  return {
    identifier: raw.identifier,
    description: raw.description,
    prompt: raw.Prompt,     // SYDLE usa P maiúsculo
    active: raw.Active,     // SYDLE usa A maiúsculo
    version: raw.Version,   // SYDLE usa V maiúsculo
  }
}

export async function getAllPrompts(token: string): Promise<DaisyPrompt[]> {
  const raw = await sydleCall(
    DAISY_PACKAGE,
    SYDLE_CLASS.daisyPrompt,
    SYDLE_METHOD.search,
    { query: { term: { Active: true } }, size: 50 },
    token,
  )
  return parseSearch<SydleDaisyPrompt>(raw).map(mapPrompt)
}

export async function getPromptByIdentifier(
  identifier: string,
  token: string,
): Promise<DaisyPrompt | null> {
  const raw = await sydleCall(
    DAISY_PACKAGE,
    SYDLE_CLASS.daisyPrompt,
    SYDLE_METHOD.search,
    { query: { term: { identifier } }, size: 1 },
    token,
  )
  const items = parseSearch<SydleDaisyPrompt>(raw)
  return items[0] ? mapPrompt(items[0]) : null
}
