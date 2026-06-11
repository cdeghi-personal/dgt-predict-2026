// Server-side only — cria/atualiza palpites da Daisy na classe predict2026.guesses
import { sydleCall, parseSearch } from '@/lib/sydle/client'
import { SYDLE_PACKAGE, SYDLE_CLASS, SYDLE_METHOD } from '@/lib/sydle/constants'
import { DAISY_USER_ID } from './constants'
import type { SydleGuess } from '@/lib/types'

export interface DaisyGuessInput {
  gameId: string
  result1: number
  result2: number
}

export async function saveDaisyGuesses(
  guesses: DaisyGuessInput[],
  token: string,
): Promise<void> {
  // Load existing guesses for Daisy to avoid duplicates
  const existing = await getDaisyExistingGuesses(token)
  const existingByGame = new Map(existing.map((g) => [g.game._id, g]))

  await Promise.allSettled(
    guesses.map(async ({ gameId, result1, result2 }) => {
      const prev = existingByGame.get(gameId)
      if (prev) {
        // Update existing guess via PATCH
        await sydleCall(
          SYDLE_PACKAGE,
          SYDLE_CLASS.guesses,
          SYDLE_METHOD.update,
          {
            _id: prev._id,
            user: { _id: DAISY_USER_ID },
            game: { _id: gameId },
            result1,
            result2,
          },
          token,
        )
      } else {
        // Create new guess
        await sydleCall(
          SYDLE_PACKAGE,
          SYDLE_CLASS.guesses,
          SYDLE_METHOD.create,
          {
            user: { _id: DAISY_USER_ID },
            game: { _id: gameId },
            result1,
            result2,
          },
          token,
        )
      }
    }),
  )
}

async function getDaisyExistingGuesses(token: string): Promise<SydleGuess[]> {
  const raw = await sydleCall(
    SYDLE_PACKAGE,
    SYDLE_CLASS.guesses,
    SYDLE_METHOD.search,
    {
      query: { term: { 'user._id': DAISY_USER_ID } },
      size: 200,
    },
    token,
  )
  return parseSearch<SydleGuess>(raw)
}
