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

export interface MatchAnalysis {
  gameId: string
  country1: string
  country2: string
  analysis: string
}

export interface DaisyGuessResult {
  gameId: string
  country1: string
  country2: string
  result1: number
  result2: number
  reasoning: string
  analysis?: string  // síntese de DAISY_MATCH_ANALYSIS
}

export interface GenerateGuessesResult {
  guesses: DaisyGuessResult[]
  analyses: MatchAnalysis[]
  newsAnalyzed: number
  gamesFound: number
  executionMs: number
  generatedAt: string
}
