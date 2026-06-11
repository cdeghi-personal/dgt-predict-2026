'use client'

import { useState, useMemo } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { CountryFlag } from '@/components/features/CountryFlag'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { GuessForm } from '@/components/features/GuessForm'
import { MatchGuessesModal } from '@/components/features/MatchGuessesModal'
import { useMyGuesses } from '@/hooks/useGuesses'
import { useMatches } from '@/hooks/useMatches'
import { isGuessingClosed, formatMatchDate, PHASE_LABELS } from '@/lib/utils/dates'
import { OUTCOME_COLORS, calculatePoints } from '@/lib/utils/scoring'
import type { Match, Guess } from '@/lib/types'

type GuessStatus = 'aberto' | 'bloqueado' | 'aguardando' | 'finalizado'

function getStatus(match: Match): GuessStatus {
  if (match.status === 'FINISHED') return 'finalizado'
  if (isGuessingClosed(match.matchDate, match.matchTime)) return 'bloqueado'
  return 'aberto'
}

const STATUS_LABELS: Record<GuessStatus, string> = {
  aberto: 'Aberto',
  bloqueado: 'Bloqueado',
  aguardando: 'Aguardando Resultado',
  finalizado: 'Finalizado',
}

const STATUS_COLORS: Record<GuessStatus, 'green' | 'gray' | 'amber' | 'blue'> = {
  aberto: 'green',
  bloqueado: 'gray',
  aguardando: 'amber',
  finalizado: 'blue',
}

export default function MeusPalpitesPage() {
  const { data: guesses, isLoading: guessesLoading } = useMyGuesses()
  const { data: matches, isLoading: matchesLoading } = useMatches()
  const [editingGuess, setEditingGuess] = useState<{ guess: Guess; match: Match } | null>(null)
  const [viewGuessesMatch, setViewGuessesMatch] = useState<Match | null>(null)

  const matchMap = useMemo(() => new Map(matches?.map((m) => [m.id, m])), [matches])

  const enriched = useMemo(() => {
    if (!guesses || !matches) return []
    return guesses
      .map((g) => ({ guess: g, match: matchMap.get(g.matchId) }))
      .filter((e): e is { guess: Guess; match: Match } => !!e.match)
      .sort((a, b) => a.match.matchDate.localeCompare(b.match.matchDate))
  }, [guesses, matches, matchMap])

  // Totais — calculados contra o resultado real do jogo (guess.points é sempre null)
  const { totalPoints, totalExact, totalCorrect } = useMemo(() => {
    let pts = 0, exact = 0, correct = 0
    for (const { guess, match } of enriched) {
      if (match.scoreCountry1 == null || match.scoreCountry2 == null) continue
      const { points, outcome } = calculatePoints(guess.result1, guess.result2, match.scoreCountry1, match.scoreCountry2)
      pts += points
      if (outcome === 'EXACT') exact++
      if (outcome === 'CORRECT') correct++
    }
    return { totalPoints: pts, totalExact: exact, totalCorrect: correct }
  }, [enriched])

  if (guessesLoading || matchesLoading) return <PageLoader />

  return (
    <>
    {viewGuessesMatch && (
      <MatchGuessesModal
        match={viewGuessesMatch}
        isOpen={true}
        onClose={() => setViewGuessesMatch(null)}
      />
    )}
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-dark">Meus Palpites</h1>
        <p className="text-sm text-mid-gray">{enriched.length} palpites registrados</p>
      </div>

      {/* Resumo */}
      {enriched.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <SummaryCard label="Pontos" value={String(totalPoints)} color="text-primary" />
          <SummaryCard label="🎯 Exatos" value={String(totalExact)} color="text-amber-600" />
          <SummaryCard label="✅ Certos" value={String(totalCorrect)} color="text-green-600" />
        </div>
      )}

      {/* Modal de edição */}
      {editingGuess && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center p-4">
          <div className="w-full max-w-sm">
            <GuessForm
              match={editingGuess.match}
              existingGuess={editingGuess.guess}
              onClose={() => setEditingGuess(null)}
            />
          </div>
        </div>
      )}

      {/* Lista */}
      {enriched.length === 0 ? (
        <div className="text-center py-16 text-mid-gray">
          <p className="text-4xl mb-3">⚽</p>
          <p className="font-medium">Nenhum palpite registrado.</p>
          <p className="text-sm">Acesse "Jogos" para registrar seus palpites.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {enriched.map(({ guess, match }) => {
            const status = getStatus(match)
            const hasResult = match.scoreCountry1 != null && match.scoreCountry2 != null
            const outcome = hasResult
              ? calculatePoints(guess.result1, guess.result2, match.scoreCountry1!, match.scoreCountry2!)
              : null

            return (
              <Card key={guess.id} className="p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="text-xs text-mid-gray">
                      {formatMatchDate(match.matchDate)} · {match.matchTime}
                    </p>
                    <p className="text-xs text-mid-gray/70">
                      {PHASE_LABELS[match.phase] ?? match.phase}
                      {match.group ? ` · Grupo ${match.group}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {outcome && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${OUTCOME_COLORS[outcome.outcome]}`}>
                        +{outcome.points} pts
                      </span>
                    )}
                    <Badge color={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Badge>
                    {status === 'aberto' && (
                      <button
                        onClick={() => setEditingGuess({ guess, match })}
                        className="text-mid-gray hover:text-dark transition-colors p-1 rounded-lg hover:bg-gray-100"
                        title="Alterar palpite"
                      >
                        ✏️
                      </button>
                    )}
                  </div>
                </div>

                {/* Confronto */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CountryFlag flag={match.country1.flag} name={match.country1.name} size="sm" />
                    <span className="text-sm font-semibold text-dark">{match.country1.name}</span>
                  </div>

                  <div className="text-center">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-dark">{guess.result1}</span>
                      <span className="text-mid-gray text-base font-semibold">×</span>
                      <span className="text-2xl font-bold text-dark">{guess.result2}</span>
                    </div>
                    {hasResult && (
                      <p className="text-xs text-mid-gray">
                        Real: {match.scoreCountry1} × {match.scoreCountry2}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 justify-end">
                    <span className="text-sm font-semibold text-dark">{match.country2.name}</span>
                    <CountryFlag flag={match.country2.flag} name={match.country2.name} size="sm" />
                  </div>
                </div>

                {/* Ver palpites dos participantes — após fechamento */}
                {isGuessingClosed(match.matchDate, match.matchTime) && (
                  <button
                    onClick={() => setViewGuessesMatch(match)}
                    className="mt-3 w-full py-1.5 rounded-xl text-xs font-medium text-mid-gray border border-light-gray hover:border-dark hover:text-dark transition-colors"
                  >
                    👥 Ver palpites dos participantes
                  </button>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
    </>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Card className="p-3 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-mid-gray">{label}</p>
    </Card>
  )
}
