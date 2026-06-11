import type { ScoreOutcome, ScoreResult } from '../types'

/**
 * Calcula pontuação de um palpite contra o resultado real.
 * - Placar exato: 10 pts
 * - Resultado correto (vitória/empate/derrota): 5 pts
 * - Errou: 0 pts
 */
export function calculatePoints(
  guess1: number,
  guess2: number,
  actual1: number,
  actual2: number,
): ScoreResult {
  const isExact = guess1 === actual1 && guess2 === actual2

  if (isExact) {
    return { points: 10, outcome: 'EXACT' }
  }

  const guessOutcome = Math.sign(guess1 - guess2)
  const actualOutcome = Math.sign(actual1 - actual2)

  if (guessOutcome === actualOutcome) {
    return { points: 5, outcome: 'CORRECT' }
  }

  return { points: 0, outcome: 'WRONG' }
}

export const OUTCOME_LABELS: Record<ScoreOutcome, string> = {
  EXACT: 'Placar exato',
  CORRECT: 'Resultado correto',
  WRONG: 'Errou',
}

export const OUTCOME_COLORS: Record<ScoreOutcome, string> = {
  EXACT: 'bg-amber-100 text-amber-800',
  CORRECT: 'bg-green-100 text-green-800',
  WRONG: 'bg-red-100 text-red-700',
}
