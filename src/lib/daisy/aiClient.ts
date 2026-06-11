// Server-side only — never import on client

interface AnthropicContent {
  type: string
  text: string
}

interface AnthropicResponse {
  content: AnthropicContent[]
}

export async function callClaude(
  systemPrompt: string,
  userMessage: string,
  opts?: { temperature?: number; maxTokens?: number; model?: string },
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY não configurada.')

  const model = opts?.model ?? 'claude-haiku-4-5-20251001'

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: opts?.maxTokens ?? 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      temperature: opts?.temperature ?? 0.7,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Anthropic API error (${res.status}): ${text}`)
  }

  const data: AnthropicResponse = await res.json()
  return data.content[0]?.text ?? ''
}

export function parseJsonFromText<T>(text: string): T {
  const match = text.match(/```json\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
  const raw = match ? (match[1] ?? match[0]).trim() : text.trim()
  return JSON.parse(raw) as T
}
