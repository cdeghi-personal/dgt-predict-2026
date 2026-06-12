// ─── SYDLE System Types ───────────────────────────────────────────────────────

export interface SydleRef {
  _id: string
  name?: string
  login?: string
  country?: string
  flag?: string
}

export interface SydleSearchHit<T> {
  _source: T
  _id: string
}

export interface SydleSearchResponse<T> {
  hits: {
    hits: SydleSearchHit<T>[]
    total: { value: number }
  }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface SydleAuthResponse {
  code: string
  name: string
  login: string
  accessToken: {
    token: string
    payload: {
      exp: number
      sessionId: string
    }
  }
}

export interface AuthUser {
  id: string
  name: string
  login: string
  token: string
  tokenExp: number
  isAdmin: boolean
}

// ─── Countries (paises) ───────────────────────────────────────────────────────

export interface SydleCountryFlag {
  _id: string
  name: string
  contentType: string
}

export interface SydleCountry {
  _id: string
  country: string
  flag?: SydleCountryFlag | null
  _creationDate?: string
}

export interface Country {
  id: string
  name: string
  flag: string
}

// ─── Games (class: game / Jogos) ──────────────────────────────────────────────
// Campos confirmados pelo JSON SYDLE:
//   country1  REFERENCE → paises (required)
//   country2  REFERENCE → paises (required)
//   date      DATE com hora (noTime=false), armazenado como timestamp ms
//   city      STRING
//   group     STRING  valores: A B C D E F G H I J  (vazio para mata-mata)
//   phase     STRING  valores: grupos | oitavas | quartas | semifinais | finais

export type MatchPhase = 'grupos' | 'oitavas' | 'quartas' | 'semifinais' | 'finais'

export interface SydleGame {
  _id: string
  country1: SydleRef
  country2: SydleRef
  date?: number | string   // timestamp ms
  city?: string
  group?: string
  phase?: MatchPhase
  _creationDate?: number
  _lastUpdateDate?: number
}

// ─── Results (class: results / Resultados) ────────────────────────────────────
// Campos confirmados:
//   game     REFERENCE → game (required)
//   result1  INTEGER 0-12  (placar do country1)
//   result2  INTEGER 0-12  (placar do country2)

export interface SydleResult {
  _id: string
  game: SydleRef
  result1: number
  result2: number
  _creationDate?: number
}

// ─── Match (montado de SydleGame + SydleResult opcional) ─────────────────────

export type MatchStatus = 'SCHEDULED' | 'FINISHED'

export interface Match {
  id: string             // game._id
  resultId: string | null  // result._id; null = sem resultado ainda
  country1: Country
  country2: Country
  matchDate: string      // "YYYY-MM-DD" derivado do timestamp game.date
  matchTime: string      // "HH:MM" derivado do timestamp game.date
  city: string
  group: string          // "A"–"J" ou "" em mata-mata
  phase: MatchPhase
  status: MatchStatus    // FINISHED quando resultId != null
  scoreCountry1: number | null
  scoreCountry2: number | null
}

// ─── Guesses (class: guesses / Palpites) ──────────────────────────────────────
// Campos confirmados:
//   user     REFERENCE → usuário SYDLE (opcional)
//   game     REFERENCE → game (required)
//   result1  INTEGER 0-12  (palpite placar country1)
//   result2  INTEGER 0-12  (palpite placar country2)

export interface SydleGuess {
  _id: string
  user?: SydleRef
  game: SydleRef
  result1: number
  result2: number
  userName?: string          // campo desnormalizado calculado pelo SYDLE no _save
  _creationDate?: number | string
  _lastUpdateDate?: number | string
}

export interface Guess {
  id: string
  userId: string
  userName: string
  matchId: string     // = game._id
  result1: number
  result2: number
  points: number | null  // calculado em runtime via scoring.ts; não está no SYDLE
}

// ─── Ranking ──────────────────────────────────────────────────────────────────

export interface RankingEntry {
  userId: string
  userName: string
  totalPoints: number
  exactScores: number
  correctResults: number
  position: number
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

export type ScoreOutcome = 'EXACT' | 'CORRECT' | 'WRONG'

export interface ScoreResult {
  points: number
  outcome: ScoreOutcome
}

// ─── Admin Audit ──────────────────────────────────────────────────────────────

export interface AuditEntry {
  id: string
  matchId: string
  matchLabel: string
  previousScore1: number | null
  previousScore2: number | null
  newScore1: number
  newScore2: number
  changedBy: string
  changedAt: number
}

// ─── Daisy — Prompts (classe daisyPrompt) ────────────────────────────────────
// Atenção: campos com inicial maiúscula (Prompt, Active, Version) — typo SYDLE

export interface SydleDaisyPrompt {
  _id: string
  identifier: string
  Prompt: string
  Active: boolean
  Version: string
  temperature?: number | null
  model?: string | null
  description?: string
  _creationDate?: number | string
  _lastUpdateDate?: number | string
}

// ─── Daisy — Diário (classe daisyDiary) ──────────────────────────────────────
// Atenção: "tytle" e "subtytle" — typos SYDLE intencionais

export interface SydleDaisyDiary {
  _id: string
  tytle: string
  subtytle: string
  content: string
  active: boolean
  date?: string              // "YYYY-MM-DDT00:00:00Z" — data de referência do diário
  featuredMatch?: string     // matérias usadas pela IA para gerar o diário
  _creationDate?: number | string
  _lastUpdateDate?: number | string
}

export interface DaisyDiary {
  id: string
  title: string
  subtitle: string
  content: string
  active: boolean
  date?: string              // "YYYY-MM-DDT00:00:00Z"
  featuredMatch?: string     // matérias usadas pela IA para gerar o diário
  createdAt: string
  updatedAt?: string
}
