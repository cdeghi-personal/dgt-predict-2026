// Identificador da aplicação no SYDLE (configurar via .env.local)
export const SYDLE_ORG = process.env.SYDLE_ORG ?? ''
export const SYDLE_APP = process.env.SYDLE_APP ?? 'dgtPredict'
export const SYDLE_PACKAGE = process.env.SYDLE_PACKAGE ?? 'predict2026'

export const SYDLE_BASE_URL = `https://${SYDLE_ORG}.sydle.one/api/1/${SYDLE_APP}`

// Identificadores das classes (identifier no SYDLE)
export const SYDLE_CLASS = {
  countries: 'paises',   // Países
  games: 'game',         // Jogos (metadados da partida)
  results: 'results',    // Resultados (placar real — criado ao finalizar)
  guesses: 'guesses',    // Palpites
} as const

// Métodos SYDLE disponíveis
export const SYDLE_METHOD = {
  search: '_search',
  create: '_create',
  update: '_update',
  patch: '_patch',
  get: '_get',
  delete: '_delete',
} as const
