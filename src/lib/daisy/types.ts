// Tipos exclusivos da feature Daisy — server-side + client-side
import type { DaisyDiary } from '@/lib/types'

export type DaisyAITestResult = {
  success: boolean
  provider: 'OpenAI'
  model: string
  message?: string
  error?: string
}

export interface DaisyPrompt {
  identifier: string
  description?: string
  prompt: string    // mapeado de SYDLE "Prompt" (P maiúsculo)
  active: boolean   // mapeado de SYDLE "Active" (A maiúsculo)
  version: string   // mapeado de SYDLE "Version" (V maiúsculo)
}

export interface NewsItem {
  url: string
  title: string
  description: string
}

export interface NewsResult {
  items: NewsItem[]
  successUrls: string[]
  errorUrls: string[]
  summary: string
}

export interface GenerateDiaryResult {
  diary: DaisyDiary
  newsResult: NewsResult
  newsAnalyzed: number
  gamesConsidered: number
  executionMs: number
  generatedAt: string
}
