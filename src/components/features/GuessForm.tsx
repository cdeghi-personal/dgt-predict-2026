'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ScoreInput } from '@/components/ui/Input'
import { CountryFlag } from './CountryFlag'
import { isGuessingClosed } from '@/lib/utils/dates'
import { useCreateGuess, useUpdateGuess } from '@/hooks/useGuesses'
import type { Match, Guess } from '@/lib/types'

interface GuessFormProps {
  match: Match
  existingGuess?: Guess | null
  onClose?: () => void
}

export function GuessForm({ match, existingGuess, onClose }: GuessFormProps) {
  const [score1, setScore1] = useState(existingGuess?.result1 ?? 0)
  const [score2, setScore2] = useState(existingGuess?.result2 ?? 0)
  const [error, setError] = useState<string | null>(null)

  const create = useCreateGuess()
  const update = useUpdateGuess()

  const isClosed = isGuessingClosed(match.matchDate, match.matchTime)
  const isSubmitting = create.isPending || update.isPending

  async function handleSubmit() {
    setError(null)
    try {
      if (existingGuess) {
        await update.mutateAsync({ id: existingGuess.id, result1: score1, result2: score2 })
      } else {
        await create.mutateAsync({
          matchId: match.id,
          result1: score1,
          result2: score2,
        })
      }
      onClose?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar.')
    }
  }

  return (
    <Card className="p-5">
      <h3 className="text-sm font-bold text-dark mb-4 text-center">
        {existingGuess ? 'Alterar Palpite' : 'Registrar Palpite'}
      </h3>

      {isClosed && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 text-center">
          ⏰ O prazo para palpitar neste jogo encerrou.
        </div>
      )}

      {/* Placar */}
      <div className="flex items-center justify-center gap-4 mb-5">
        <div className="flex flex-col items-center gap-2">
          <CountryFlag flag={match.country1.flag} name={match.country1.name} size="lg" />
          <p className="text-xs font-semibold text-dark text-center max-w-[80px] leading-tight">
            {match.country1.name}
          </p>
          <ScoreInput value={score1} onChange={setScore1} disabled={isClosed || isSubmitting} />
        </div>

        <span className="text-2xl font-bold text-light-gray mt-8">×</span>

        <div className="flex flex-col items-center gap-2">
          <CountryFlag flag={match.country2.flag} name={match.country2.name} size="lg" />
          <p className="text-xs font-semibold text-dark text-center max-w-[80px] leading-tight">
            {match.country2.name}
          </p>
          <ScoreInput value={score2} onChange={setScore2} disabled={isClosed || isSubmitting} />
        </div>
      </div>

      {/* Regras rápidas */}
      <div className="flex justify-center gap-4 text-xs text-mid-gray mb-4">
        <span>🎯 Placar exato = <strong>10 pts</strong></span>
        <span>✅ Resultado certo = <strong>5 pts</strong></span>
      </div>

      {error && (
        <p className="text-xs text-red-500 text-center mb-3">{error}</p>
      )}

      <div className="flex gap-2">
        {onClose && (
          <Button variant="outline" size="sm" onClick={onClose} fullWidth>
            Cancelar
          </Button>
        )}
        {!isClosed && (
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            loading={isSubmitting}
            fullWidth
          >
            {existingGuess ? 'Atualizar' : 'Confirmar Palpite'}
          </Button>
        )}
      </div>
    </Card>
  )
}
