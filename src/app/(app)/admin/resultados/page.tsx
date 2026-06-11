'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { CountryFlag } from '@/components/features/CountryFlag'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { useAuth } from '@/contexts/AuthContext'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatMatchDate, PHASE_LABELS } from '@/lib/utils/dates'
import type { Match } from '@/lib/types'

function useAdminMatches() {
  const { authHeader } = useAuth()
  return useQuery<Match[]>({
    queryKey: ['admin-matches'],
    queryFn: async () => {
      const res = await fetch('/api/admin/results', { headers: authHeader() })
      if (!res.ok) throw new Error('Erro ao buscar partidas.')
      return res.json()
    },
    staleTime: 30_000,
  })
}

export default function AdminResultadosPage() {
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!user?.isAdmin) router.replace('/dashboard')
  }, [user, router])

  const { data: matches, isLoading } = useAdminMatches()

  const pending = useMemo(() => matches?.filter((m) => m.status !== 'FINISHED') ?? [], [matches])
  const finished = useMemo(() => matches?.filter((m) => m.status === 'FINISHED') ?? [], [matches])

  if (!user?.isAdmin) return null
  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-dark">Administração — Resultados</h1>
        <p className="text-sm text-mid-gray">
          {pending.length} jogo(s) aguardando resultado
        </p>
      </div>

      {/* Pendentes */}
      {pending.length > 0 && (
        <section>
          <h2 className="text-xs font-bold text-mid-gray uppercase tracking-wide mb-3">Aguardando Resultado</h2>
          <div className="space-y-3">
            {pending.map((match) => (
              <ResultEntryCard key={match.id} match={match} />
            ))}
          </div>
        </section>
      )}

      {/* Finalizados */}
      {finished.length > 0 && (
        <section>
          <h2 className="text-xs font-bold text-mid-gray uppercase tracking-wide mb-3">Resultados Registrados</h2>
          <div className="space-y-3">
            {finished.map((match) => (
              <FinishedMatchCard key={match.id} match={match} />
            ))}
          </div>
        </section>
      )}

      {matches?.length === 0 && (
        <div className="text-center py-16 text-mid-gray">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-medium">Nenhuma partida cadastrada.</p>
          <p className="text-sm">Cadastre as partidas no SYDLE ONE (classe game).</p>
        </div>
      )}
    </div>
  )
}

// ─── Card para registrar resultado (jogo sem resultado ainda) ─────────────────

function ResultEntryCard({ match }: { match: Match }) {
  const [score1, setScore1] = useState('')
  const [score2, setScore2] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { authHeader } = useAuth()
  const qc = useQueryClient()

  const save = useMutation({
    mutationFn: async () => {
      // POST cria um novo registro na classe results
      const res = await fetch('/api/admin/results', {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({
          gameId: match.id,
          result1: Number(score1),
          result2: Number(score2),
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Erro ao salvar.')
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-matches'] })
      qc.invalidateQueries({ queryKey: ['matches'] })
      qc.invalidateQueries({ queryKey: ['ranking'] })
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Erro.'),
  })

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <Badge color="amber">
          {PHASE_LABELS[match.phase] ?? match.phase}
          {match.group ? ` · G.${match.group}` : ''}
        </Badge>
        <span className="text-xs text-mid-gray">
          {match.matchDate ? `${formatMatchDate(match.matchDate)} · ${match.matchTime}` : '–'}
          {match.city ? ` · ${match.city}` : ''}
        </span>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2 flex-1">
          <CountryFlag flag={match.country1.flag} name={match.country1.name} size="sm" />
          <span className="text-sm font-semibold text-dark truncate">{match.country1.name}</span>
        </div>
        <span className="text-mid-gray font-bold">vs</span>
        <div className="flex items-center gap-2 flex-1 justify-end">
          <span className="text-sm font-semibold text-dark truncate">{match.country2.name}</span>
          <CountryFlag flag={match.country2.flag} name={match.country2.name} size="sm" />
        </div>
      </div>

      <div className="flex items-center gap-3 mb-3">
        <input
          type="number"
          min={0}
          max={20}
          value={score1}
          onChange={(e) => setScore1(e.target.value)}
          placeholder="0"
          className="w-16 h-10 text-center text-lg font-bold rounded-xl border-2 border-light-gray focus:border-primary focus:outline-none"
        />
        <span className="text-mid-gray font-bold text-lg flex-1 text-center">×</span>
        <input
          type="number"
          min={0}
          max={20}
          value={score2}
          onChange={(e) => setScore2(e.target.value)}
          placeholder="0"
          className="w-16 h-10 text-center text-lg font-bold rounded-xl border-2 border-light-gray focus:border-primary focus:outline-none"
        />
      </div>

      {error && <p className="text-xs text-red-500 mb-2 text-center">{error}</p>}

      <Button
        variant="primary"
        fullWidth
        size="sm"
        loading={save.isPending}
        disabled={score1 === '' || score2 === ''}
        onClick={() => save.mutate()}
      >
        Registrar Resultado
      </Button>
    </Card>
  )
}

// ─── Card de jogo já finalizado (com opção de corrigir o placar) ──────────────

function FinishedMatchCard({ match }: { match: Match }) {
  const [editing, setEditing] = useState(false)
  const [score1, setScore1] = useState(String(match.scoreCountry1 ?? ''))
  const [score2, setScore2] = useState(String(match.scoreCountry2 ?? ''))
  const [error, setError] = useState<string | null>(null)
  const { authHeader } = useAuth()
  const qc = useQueryClient()

  const update = useMutation({
    mutationFn: async () => {
      // PATCH atualiza o registro na classe results usando o resultId
      const res = await fetch(`/api/admin/results/${match.resultId}`, {
        method: 'PATCH',
        headers: authHeader(),
        body: JSON.stringify({ result1: Number(score1), result2: Number(score2) }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Erro ao atualizar.')
      }
    },
    onSuccess: () => {
      setEditing(false)
      qc.invalidateQueries({ queryKey: ['admin-matches'] })
      qc.invalidateQueries({ queryKey: ['matches'] })
      qc.invalidateQueries({ queryKey: ['ranking'] })
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Erro.'),
  })

  if (!editing) {
    return (
      <Card className="p-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <CountryFlag flag={match.country1.flag} name={match.country1.name} size="sm" />
            <span className="text-sm font-medium text-dark truncate">{match.country1.name}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="w-8 h-8 bg-dark text-white flex items-center justify-center rounded-lg font-bold text-sm">
              {match.scoreCountry1}
            </span>
            <span className="text-mid-gray">×</span>
            <span className="w-8 h-8 bg-dark text-white flex items-center justify-center rounded-lg font-bold text-sm">
              {match.scoreCountry2}
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
            <span className="text-sm font-medium text-dark truncate">{match.country2.name}</span>
            <CountryFlag flag={match.country2.flag} name={match.country2.name} size="sm" />
          </div>
          <button
            onClick={() => setEditing(true)}
            className="shrink-0 text-xs text-mid-gray underline hover:text-dark ml-1"
          >
            Editar
          </button>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-4 border-2 border-primary">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center gap-2 flex-1">
          <CountryFlag flag={match.country1.flag} name={match.country1.name} size="sm" />
          <span className="text-sm font-semibold text-dark truncate">{match.country1.name}</span>
        </div>
        <span className="text-mid-gray font-bold">vs</span>
        <div className="flex items-center gap-2 flex-1 justify-end">
          <span className="text-sm font-semibold text-dark truncate">{match.country2.name}</span>
          <CountryFlag flag={match.country2.flag} name={match.country2.name} size="sm" />
        </div>
      </div>

      <div className="flex items-center gap-3 mb-3">
        <input
          type="number" min={0} max={20} value={score1}
          onChange={(e) => setScore1(e.target.value)}
          className="w-16 h-10 text-center text-lg font-bold rounded-xl border-2 border-primary focus:outline-none"
        />
        <span className="text-mid-gray font-bold text-lg flex-1 text-center">×</span>
        <input
          type="number" min={0} max={20} value={score2}
          onChange={(e) => setScore2(e.target.value)}
          className="w-16 h-10 text-center text-lg font-bold rounded-xl border-2 border-primary focus:outline-none"
        />
      </div>

      {error && <p className="text-xs text-red-500 mb-2 text-center">{error}</p>}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" fullWidth onClick={() => setEditing(false)}>
          Cancelar
        </Button>
        <Button
          variant="primary" size="sm" fullWidth
          loading={update.isPending}
          disabled={score1 === '' || score2 === ''}
          onClick={() => update.mutate()}
        >
          Salvar
        </Button>
      </div>
    </Card>
  )
}
