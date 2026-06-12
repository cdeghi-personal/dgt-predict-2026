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

// Debug por URL de notícia
export interface NewsUrlDebug {
  url: string
  status: 'success' | 'error'
  errorMessage?: string
  contentPreview?: string    // primeiros 250 chars do HTML (sem tags)
  durationMs: number
}

export interface NewsResult {
  items: NewsItem[]           // sempre [] — conteúdo não exposto diretamente
  successUrls: string[]
  errorUrls: string[]
  summary: string             // resumo gerado pela IA com o conteúdo das fontes
  summaryPreview: string      // primeiros 400 chars do summary para debug
  urlResults: NewsUrlDebug[]  // resultado por URL para auditoria
}

// Debug por resultado no SYDLE (visão resultado-primeiro)
export interface ResultDebugEntry {
  resultId: string
  gameId: string
  country1: string
  country2: string
  score: string              // "2×1"
  gameDateMs: number | null  // null = jogo não encontrado no gameMap ou data inválida
  gameDateLabel: string      // "2026-06-11T19:00" ou "NaN" ou "não encontrado"
  gameFoundInMap: boolean    // game._id resolveu no gameMap (allGamesAll)
  isInFuture: boolean
  withinWindow: boolean
}

// ─── Debug/Auditoria da geração ───────────────────────────────────────────────

export interface DiaryDebugGameEntry {
  gameId: string
  country1: string
  country2: string
  gameDateRaw: string | number | undefined
  gameDateMs: number | null
  hasResult: boolean
  result1?: number
  result2?: number
  group: string
  phase: string
  isInFuture: boolean
  withinWindow: boolean
}

export interface DiaryDebugInfo {
  model: string
  generatedAt: string
  cutoffMs: number
  cutoffLabel: string
  lastDiaryDate?: string

  // Contagens brutas
  gamesRawCount: number
  resultsRawCount: number
  promptsLoadedCount: number

  // Resultados — visão principal (resultado-primeiro)
  resultsDebug: ResultDebugEntry[]

  // Jogos — visão secundária (jogo-primeiro, top 50 por data)
  allGamesAnalyzed: DiaryDebugGameEntry[]

  // O que foi enviado à IA
  recentResultEntries: Array<{
    country1: string; country2: string
    result1: number; result2: number
    group: string; phase: string; finishedAt: string
  }>
  upcomingGamesDebug: Array<{
    gameId: string; country1: string; country2: string; gameDateMs: number | null
  }>

  // Notícias — debug por URL
  newsUrlResults: NewsUrlDebug[]
  newsSummaryPreview: string
  newsSummaryEmpty: boolean

  promptsLoaded: Array<{
    identifier: string; version: string; active: boolean; preview: string
  }>

  // IA
  finalPrompt: string
  rawAIResponse: string

  // SYDLE _create
  savedPayload: {
    date: string
    tytle: string
    subtytle: string
    contentPreview: string
    featuredMatch?: string
  } | null

  // Validação
  validationPassed: boolean
  validationNote: string
}

// ─── Resultado da geração ─────────────────────────────────────────────────────

export interface GenerateDiaryResult {
  diary: DaisyDiary | null
  saved: boolean
  validationError?: string
  debug: DiaryDebugInfo
  newsResult: NewsResult
  newsAnalyzed: number        // = successUrls.length
  recentResultsCount: number
  upcomingGamesCount: number
  newsHighlightsCount: number // = successUrls.length (fontes que responderam)
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
  analysis?: string
}

export interface GenerateGuessesResult {
  guesses: DaisyGuessResult[]
  analyses: MatchAnalysis[]
  newsAnalyzed: number
  gamesFound: number
  executionMs: number
  generatedAt: string
}
