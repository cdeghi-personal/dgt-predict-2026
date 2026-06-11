'use client'

import { clsx } from 'clsx'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { CountryFlag } from './CountryFlag'
import { formatMatchDate, PHASE_LABELS } from '@/lib/utils/dates'
import type { Match, Guess } from '@/lib/types'

interface MatchCardProps {
  match: Match
  guess?: Guess | null
  onGuess?: () => void
  compact?: boolean
}

export function MatchCard({ match, guess, onGuess, compact }: MatchCardProps) {
  const isFinished = match.status === 'FINISHED'
  const hasResult = match.scoreCountry1 != null && match.scoreCountry2 != null

  return (
    <Card
      highlight={!!onGuess && !guess}
      className={compact ? 'p-3' : 'p-4'}
    >
      {/* Header: fase / grupo + data */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Badge color={isFinished ? 'gray' : 'blue'}>
            {PHASE_LABELS[match.phase] ?? match.phase}
            {match.group ? ` · Grupo ${match.group}` : ''}
          </Badge>
        </div>
        <span className="text-xs text-mid-gray">
          {match.matchDate ? `${formatMatchDate(match.matchDate)} · ${match.matchTime}` : '–'}
        </span>
      </div>

      {/* Confronto */}
      <div className="flex items-center gap-2">
        {/* País 1 */}
        <div className="flex-1 flex flex-col items-center gap-1">
          <CountryFlag flag={match.country1.flag} name={match.country1.name} size="lg" />
          <span className="text-xs font-semibold text-dark text-center leading-tight">
            {match.country1.name}
          </span>
          {guess && (
            <GuessBox value={guess.result1} side="left" guess={guess} match={match} />
          )}
        </div>

        {/* Centro: placar real ou "vs" + badge de pontos */}
        <div className="flex flex-col items-center gap-1 min-w-[80px]">
          {hasResult ? (
            <div className="flex items-center gap-2">
              <ScoreBox value={match.scoreCountry1!} />
              <span className="text-mid-gray font-bold text-sm">×</span>
              <ScoreBox value={match.scoreCountry2!} />
            </div>
          ) : (
            <span className="text-xl font-bold text-light-gray">vs</span>
          )}
          {/* Badge de pontos (só após resultado) */}
          {isFinished && guess?.points != null && (
            <span className={clsx(
              'text-xs font-bold px-2 py-0.5 rounded-full',
              guess.points === 10 ? 'bg-amber-100 text-amber-800' :
              guess.points === 5  ? 'bg-green-100 text-green-800' :
                                    'bg-red-50 text-red-700',
            )}>
              +{guess.points} pts
            </span>
          )}
          {/* Label "Seu palpite" + link Alterar quando ainda não tem resultado */}
          {!isFinished && guess && (
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[10px] text-mid-gray">seu palpite</span>
              {onGuess && (
                <button
                  onClick={onGuess}
                  className="text-[10px] text-mid-gray hover:text-dark flex items-center gap-0.5 hover:underline transition-colors"
                >
                  ✏️ alterar
                </button>
              )}
            </div>
          )}
        </div>

        {/* País 2 */}
        <div className="flex-1 flex flex-col items-center gap-1">
          <CountryFlag flag={match.country2.flag} name={match.country2.name} size="lg" />
          <span className="text-xs font-semibold text-dark text-center leading-tight">
            {match.country2.name}
          </span>
          {guess && (
            <GuessBox value={guess.result2} side="right" guess={guess} match={match} />
          )}
        </div>
      </div>

      {/* CTA palpitar — só quando ainda não tem palpite */}
      {onGuess && !guess && (
        <button
          onClick={onGuess}
          className="mt-3 w-full py-2 rounded-xl text-sm font-semibold transition-colors bg-primary text-dark hover:bg-amber-400"
        >
          ⚽ Dar Palpite
        </button>
      )}
    </Card>
  )
}

function ScoreBox({ value }: { value: number }) {
  return (
    <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-dark text-white text-xl font-bold">
      {value}
    </div>
  )
}

function GuessBox({ value, guess, match }: { value: number; side: 'left' | 'right'; guess: Guess; match: Match }) {
  const isFinished = match.status === 'FINISHED'
  let style = 'border-2 border-blue-300 text-blue-700 bg-blue-50'
  if (isFinished) {
    if (guess.points === 10) style = 'border-2 border-amber-400 text-amber-800 bg-amber-50'
    else if (guess.points === 5) style = 'border-2 border-green-400 text-green-800 bg-green-50'
    else style = 'border-2 border-red-300 text-red-700 bg-red-50'
  }
  return (
    <div className={clsx(
      'w-10 h-10 flex items-center justify-center rounded-lg text-xl font-bold mt-1',
      style,
    )}>
      {value}
    </div>
  )
}
