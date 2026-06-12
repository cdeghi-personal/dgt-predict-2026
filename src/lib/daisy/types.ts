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

// ─── Debug/Auditoria da geração ───────────────────────────────────────────────

export interface DiaryDebugGameEntry {
  gameId: string
  country1: string
  country2: string
  gameDateRaw: string | number | undefined   // valor bruto vindo do SYDLE
  gameDateMs: number | null                  // null = não foi possível parsear
  hasResult: boolean
  result1?: number
  result2?: number
  group: string
  phase: string
  isInFuture: boolean      // gameDate > now
  withinWindow: boolean    // passou o filtro recentCutoff
}

export interface DiaryDebugInfo {
  model: string
  generatedAt: string
  cutoffMs: number
  cutoffLabel: string        // ISO + BRT legível
  lastDiaryDate?: string     // data do último diário gerado (ou undefined)

  // Contagens brutas do SYDLE
  gamesRawCount: number
  resultsRawCount: number
  promptsLoadedCount: number

  // Dados processados enviados à IA
  allGamesAnalyzed: DiaryDebugGameEntry[]
  recentResultEntries: Array<{
    country1: string; country2: string
    result1: number; result2: number
    group: string; phase: string; finishedAt: string
  }>
  upcomingGamesDebug: Array<{
    gameId: string; country1: string; country2: string; gameDateMs: number | null
  }>
  newsItems: Array<{ title: string; description: string }>
  promptsLoaded: Array<{
    identifier: string; version: string; active: boolean; preview: string
  }>

  // IA
  finalPrompt: string       // mensagem de usuário completa enviada ao modelo
  rawAIResponse: string     // resposta bruta antes do parse

  // SYDLE _create
  savedPayload: {
    date: string
    tytle: string
    subtytle: string
    contentPreview: string  // primeiros 500 chars
    featuredMatch?: string
  } | null

  // Validação
  validationPassed: boolean
  validationNote: string
}

// ─── Resultado da geração ─────────────────────────────────────────────────────

export interface GenerateDiaryResult {
  diary: DaisyDiary | null    // null quando validationPassed === false
  saved: boolean
  validationError?: string    // preenchido quando saved === false
  debug: DiaryDebugInfo
  newsResult: NewsResult
  newsAnalyzed: number
  recentResultsCount: number
  upcomingGamesCount: number
  newsHighlightsCount: number
  hasRecentResults: boolean
  gamesConsidered: number
  executionMs: number
  generatedAt: string
}

// ─── Palpites ─────────────────────────────────────────────────────────────────

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
