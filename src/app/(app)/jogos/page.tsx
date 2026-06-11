'use client'

import { useState, useMemo } from 'react'
import { MatchCard } from '@/components/features/MatchCard'
import { GuessForm } from '@/components/features/GuessForm'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { Badge } from '@/components/ui/Badge'
import { useMatches } from '@/hooks/useMatches'
import { useMyGuesses } from '@/hooks/useGuesses'
import { PHASE_LABELS, formatMatchDate } from '@/lib/utils/dates'
import type { Match, MatchPhase } from '@/lib/types'

const PHASES: MatchPhase[] = ['grupos', 'oitavas', 'quartas', 'semifinais', 'finais']

export default function JogosPage() {
  const { data: matches, isLoading, error } = useMatches()
  const { data: myGuesses } = useMyGuesses()
  const [selectedPhase, setSelectedPhase] = useState<MatchPhase | 'all'>('all')
  const [guessingMatch, setGuessingMatch] = useState<Match | null>(null)

  const guessMap = useMemo(() => new Map(myGuesses?.map((g) => [g.matchId, g])), [myGuesses])

  // Fases com jogos disponíveis
  const availablePhases = useMemo(() => {
    const set = new Set(matches?.map((m) => m.phase))
    return PHASES.filter((p) => set.has(p))
  }, [matches])

  const filtered = useMemo(() => {
    if (!matches) return []
    if (selectedPhase === 'all') return matches
    return matches.filter((m) => m.phase === selectedPhase)
  }, [matches, selectedPhase])

  // Agrupar por data
  const grouped = useMemo(() => {
    const map = new Map<string, Match[]>()
    for (const m of filtered) {
      const key = m.matchDate || 'sem-data'
      const arr = map.get(key) ?? []
      arr.push(m)
      map.set(key, arr)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  if (isLoading) return <PageLoader />
  if (error) return (
    <div className="text-center py-16">
      <p className="text-4xl mb-3">❌</p>
      <p className="font-medium text-dark">Erro ao carregar jogos</p>
      <p className="text-sm text-mid-gray mt-1 font-mono">{String(error)}</p>
    </div>
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-dark">Jogos</h1>
        <p className="text-sm text-mid-gray">Clique em um jogo para registrar ou alterar seu palpite</p>
      </div>

      {/* Filtro de fases */}
      {availablePhases.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <button
            onClick={() => setSelectedPhase('all')}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              selectedPhase === 'all'
                ? 'bg-dark text-white'
                : 'bg-white border border-light-gray text-mid-gray hover:border-dark'
            }`}
          >
            Todos
          </button>
          {availablePhases.map((phase) => (
            <button
              key={phase}
              onClick={() => setSelectedPhase(phase)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                selectedPhase === phase
                  ? 'bg-dark text-white'
                  : 'bg-white border border-light-gray text-mid-gray hover:border-dark'
              }`}
            >
              {PHASE_LABELS[phase] ?? phase}
            </button>
          ))}
        </div>
      )}

      {/* Jogos agrupados por data */}
      {grouped.length === 0 ? (
        <div className="text-center py-16 text-mid-gray">
          <p className="text-4xl mb-3">⚽</p>
          <p className="font-medium">Nenhum jogo encontrado.</p>
          <p className="text-sm">Os jogos serão cadastrados pelo administrador.</p>
        </div>
      ) : (
        grouped.map(([date, dayMatches]) => (
          <div key={date}>
            <DateGroupHeader
              date={date}
              matchCount={dayMatches.length}
              guessCount={dayMatches.filter((m) => guessMap.has(m.id)).length}
            />
            <div className="space-y-3 mt-2">
              {dayMatches.map((match) => {
                const guess = guessMap.get(match.id) ?? null
                return (
                  <div key={match.id}>
                    {guessingMatch?.id === match.id ? (
                      <GuessForm
                        match={match}
                        existingGuess={guess}
                        onClose={() => setGuessingMatch(null)}
                      />
                    ) : (
                      <MatchCard
                        match={match}
                        guess={guess}
                        onGuess={() => setGuessingMatch(match)}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function DateGroupHeader({
  date,
  matchCount,
  guessCount,
}: {
  date: string
  matchCount: number
  guessCount: number
}) {
  const label = date === 'sem-data' ? 'Data não definida' : formatMatchDate(date)

  return (
    <div className="flex items-center gap-3 py-2">
      <h2 className="text-sm font-bold text-dark">{label}</h2>
      <div className="flex-1 h-px bg-light-gray" />
      <Badge color={guessCount === matchCount ? 'green' : 'amber'}>
        {guessCount}/{matchCount} palpites
      </Badge>
    </div>
  )
}
