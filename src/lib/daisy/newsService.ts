// Server-side only — busca e resume notícias de fontes externas
import { callOpenAI } from './aiClient'
import type { NewsResult, NewsUrlDebug } from './types'

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
  // Busca todas as fontes em paralelo — nunca rejeita, sempre resolve com status
  const fetched = await Promise.all(
    NEWS_SOURCES.map(async (url) => {
      const t0 = Date.now()
      try {
        const r = await fetch(url, {
          headers: { 'User-Agent': 'DGTPredict/1.0' },
          signal: AbortSignal.timeout(8000),
        })
        const raw = await r.text()
        return {
          url,
          ok: true,
          text: raw.slice(0, 3000),
          // Preview sem HTML para leitura humana no debug
          contentPreview: raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 250),
          durationMs: Date.now() - t0,
          error: undefined as string | undefined,
        }
      } catch (err) {
        return {
          url,
          ok: false,
          text: '',
          contentPreview: undefined,
          durationMs: Date.now() - t0,
          error: err instanceof Error ? err.message : String(err),
        }
      }
    }),
  )

  const urlResults: NewsUrlDebug[] = fetched.map((f) => ({
    url:            f.url,
    status:         f.ok ? ('success' as const) : ('error' as const),
    errorMessage:   f.error,
    contentPreview: f.contentPreview,
    durationMs:     f.durationMs,
  }))

  const successUrls = fetched.filter((f) => f.ok).map((f) => f.url)
  const errorUrls   = fetched.filter((f) => !f.ok).map((f) => f.url)
  const textParts   = fetched.filter((f) => f.ok && f.text).map((f) => f.text)

  let summary = ''
  if (textParts.length > 0 && newsSummaryPrompt) {
    try {
      summary = await callOpenAI(
        personaPrompt,
        `${newsSummaryPrompt}\n\nConteúdo esportivo recente:\n\n${textParts.join('\n\n---\n\n')}`,
        { maxTokens: 512, temperature: 0.3 },
      )
    } catch (err) {
      console.error('[daisy/news] OpenAI summary failed:', err)
      summary = ''
    }
  }

  console.log(
    `[daisy/news] Fontes: ${successUrls.length} OK / ${errorUrls.length} ERRO | Summary: ${summary ? `${summary.length} chars` : 'vazio'}`,
  )

  return {
    items:          [],   // não exposto no conteúdo final — usar summary
    successUrls,
    errorUrls,
    summary,
    summaryPreview: summary.slice(0, 400),
    urlResults,
  }
}

export function buildNewsContext(newsText: string): string {
  if (!newsText.trim()) return ''
  return `\n\nContexto esportivo recente:\n${newsText.trim()}`
}
