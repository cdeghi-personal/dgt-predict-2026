// Server-side only — busca e resume notícias de fontes externas
// As URLs das fontes são usadas apenas como contexto da IA; nunca são expostas no conteúdo final.
import { callOpenAI } from './aiClient'
import type { NewsResult } from './types'

const NEWS_SOURCES = [
  'https://ge.globo.com/futebol/copa-do-mundo/',
  'https://www.espn.com.br/futebol/',
  'https://www.uol.com.br/esporte/futebol/',
  'https://www.cnnbrasil.com.br/esportes/',
  'https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026',
]

export async function fetchAndSummarizeNews(
  newsSummaryPrompt: string,
  personaPrompt: string,
): Promise<NewsResult> {
  const results = await Promise.allSettled(
    NEWS_SOURCES.map((url) =>
      fetch(url, {
        headers: { 'User-Agent': 'DGTPredict/1.0' },
        signal: AbortSignal.timeout(8000),
      })
        .then((r) => r.text())
        .then((t) => ({ url, text: t.slice(0, 3000) })),
    ),
  )

  const successUrls: string[] = []
  const errorUrls: string[] = []
  const textParts: string[] = []

  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    const url = NEWS_SOURCES[i]
    if (r.status === 'fulfilled') {
      successUrls.push(url)
      // Passa o conteúdo sem identificar a fonte — evita que a IA cite portais
      textParts.push(r.value.text)
    } else {
      errorUrls.push(url)
    }
  }

  let summary = ''
  if (textParts.length > 0 && newsSummaryPrompt) {
    try {
      summary = await callOpenAI(
        personaPrompt,
        `${newsSummaryPrompt}\n\nConteúdo esportivo recente:\n\n${textParts.join('\n\n---\n\n')}`,
        { maxTokens: 512, temperature: 0.3 },
      )
    } catch {
      summary = ''
    }
  }

  return {
    items: [],  // URLs não expostas no conteúdo final
    successUrls,
    errorUrls,
    summary,
  }
}

export function buildNewsContext(newsText: string): string {
  if (!newsText.trim()) return ''
  return `\n\nContexto esportivo recente:\n${newsText.trim()}`
}
