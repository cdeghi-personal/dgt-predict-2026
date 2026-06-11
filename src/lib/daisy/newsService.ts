// Server-side only — busca e resume notícias externas para o diário
import { callClaude, parseJsonFromText } from './aiClient'

export async function summarizeNewsUrls(
  urls: string[],
  newsSummaryPrompt: string,
  personaPrompt: string,
): Promise<string> {
  if (urls.length === 0) return ''

  const contents = await Promise.allSettled(
    urls.map((url) =>
      fetch(url, { headers: { 'User-Agent': 'DGTPredict/1.0' }, signal: AbortSignal.timeout(8000) })
        .then((r) => r.text())
        .then((t) => t.slice(0, 3000)), // limit per URL
    ),
  )

  const texts = contents
    .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
    .map((r, i) => `URL ${i + 1}:\n${r.value}`)
    .join('\n\n---\n\n')

  if (!texts) return ''

  try {
    const result = await callClaude(personaPrompt, `${newsSummaryPrompt}\n\nConteúdos:\n${texts}`, {
      maxTokens: 512,
      temperature: 0.3,
    })
    return result
  } catch {
    return ''
  }
}

export function buildNewsContext(newsText: string): string {
  if (!newsText.trim()) return ''
  return `\n\nNotícias do dia:\n${newsText.trim()}`
}
