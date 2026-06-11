'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { CountryFlag } from '@/components/features/CountryFlag'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { useMatches } from '@/hooks/useMatches'
import { calculateGroupStandings } from '@/lib/standings'
import { PHASE_LABELS } from '@/lib/utils/dates'
import type { TeamStanding } from '@/lib/standings'
import type { Match, MatchPhase } from '@/lib/types'

const KNOCKOUT_PHASES: MatchPhase[] = ['oitavas', 'quartas', 'semifinais', 'finais']

export default function ClassificacaoPage() {
  const { data: matches, isLoading } = useMatches()

  const standings = useMemo(
    () => (matches ? calculateGroupStandings(matches) : new Map()),
    [matches],
  )

  const knockoutByPhase = useMemo(() => {
    if (!matches) return []
    return KNOCKOUT_PHASES
      .map((phase) => ({ phase, games: matches.filter((m) => m.phase === phase) }))
      .filter((p) => p.games.length > 0)
  }, [matches])

  if (isLoading) return <PageLoader />

  if (standings.size === 0 && knockoutByPhase.length === 0) {
    return (
      <div className="text-center py-16 text-mid-gray">
        <p className="text-4xl mb-3">🏆</p>
        <p className="font-medium">Classificação não disponível.</p>
        <p className="text-sm">Os jogos ainda não foram cadastrados.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-dark">Classificação</h1>
        <p className="text-sm text-mid-gray">Copa do Mundo 2026</p>
      </div>

      {standings.size > 0 && (
        <>
          <h2 className="text-sm font-bold text-dark uppercase tracking-wide -mb-3">Fase de Grupos</h2>
          {[...standings.entries()].map(([group, teams]) => (
            <GroupTable key={group} group={group} teams={teams} />
          ))}
          <Legend />
        </>
      )}

      {knockoutByPhase.length > 0 && (
        <>
          <h2 className="text-sm font-bold text-dark uppercase tracking-wide -mb-3">Fase Eliminatória</h2>
          {knockoutByPhase.map(({ phase, games }) => (
            <KnockoutPhaseTable key={phase} phase={phase} games={games} />
          ))}
        </>
      )}
    </div>
  )
}

function GroupTable({ group, teams }: { group: string; teams: TeamStanding[] }) {
  return (
    <div className="bg-white rounded-2xl border border-light-gray overflow-hidden">
      {/* Header do grupo */}
      <div className="flex items-center justify-between px-4 py-3 bg-dark">
        <h2 className="text-sm font-bold text-white">Grupo {group}</h2>
        <Link
          href={`/jogos?group=${group}`}
          className="text-xs text-primary font-semibold hover:underline"
        >
          Ver jogos →
        </Link>
      </div>

      {/* Tabela desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-light-gray bg-background">
              <th className="text-left px-4 py-2 text-mid-gray font-medium w-8">#</th>
              <th className="text-left px-4 py-2 text-mid-gray font-medium">Times</th>
              <th className="px-2 py-2 text-mid-gray font-medium text-center w-10">PG</th>
              <th className="px-2 py-2 text-mid-gray font-medium text-center w-8">J</th>
              <th className="px-2 py-2 text-mid-gray font-medium text-center w-8">V</th>
              <th className="px-2 py-2 text-mid-gray font-medium text-center w-8">E</th>
              <th className="px-2 py-2 text-mid-gray font-medium text-center w-8">D</th>
              <th className="px-2 py-2 text-mid-gray font-medium text-center w-8">GP</th>
              <th className="px-2 py-2 text-mid-gray font-medium text-center w-8">GC</th>
              <th className="px-2 py-2 text-mid-gray font-medium text-center w-8">SG</th>
              <th className="px-2 py-2 text-mid-gray font-medium text-center w-10">%</th>
              <th className="px-4 py-2 text-mid-gray font-medium text-center">Últimos jogos</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-light-gray">
            {teams.map((t, i) => (
              <TeamRow key={t.team.id} standing={t} position={i + 1} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Cards mobile */}
      <div className="md:hidden divide-y divide-light-gray">
        {teams.map((t, i) => (
          <MobileTeamRow key={t.team.id} standing={t} position={i + 1} />
        ))}
      </div>
    </div>
  )
}

function TeamRow({ standing: s, position }: { standing: TeamStanding; position: number }) {
  const isQualifying = position <= 2
  return (
    <tr className={isQualifying ? 'bg-green-50/40' : ''}>
      <td className="px-4 py-3 text-mid-gray font-medium">{position}º</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <CountryFlag flag={s.team.flag} name={s.team.name} size="sm" />
          <span className="font-semibold text-dark">{s.team.name}</span>
        </div>
      </td>
      <td className="px-2 py-3 text-center font-bold text-dark">{s.PG}</td>
      <td className="px-2 py-3 text-center text-mid-gray">{s.J}</td>
      <td className="px-2 py-3 text-center text-mid-gray">{s.V}</td>
      <td className="px-2 py-3 text-center text-mid-gray">{s.E}</td>
      <td className="px-2 py-3 text-center text-mid-gray">{s.D}</td>
      <td className="px-2 py-3 text-center text-mid-gray">{s.GP}</td>
      <td className="px-2 py-3 text-center text-mid-gray">{s.GC}</td>
      <td className="px-2 py-3 text-center text-mid-gray">{s.SG > 0 ? `+${s.SG}` : s.SG}</td>
      <td className="px-2 py-3 text-center text-mid-gray">{s.pct}</td>
      <td className="px-4 py-3">
        <LastGamesDots results={s.lastGames} />
      </td>
    </tr>
  )
}

function MobileTeamRow({ standing: s, position }: { standing: TeamStanding; position: number }) {
  const isQualifying = position <= 2
  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${isQualifying ? 'bg-green-50/40' : ''}`}>
      <span className="text-xs text-mid-gray w-5 shrink-0">{position}º</span>
      <CountryFlag flag={s.team.flag} name={s.team.name} size="sm" />
      <span className="flex-1 text-sm font-semibold text-dark truncate">{s.team.name}</span>
      <div className="flex items-center gap-3 text-xs">
        <span className="font-bold text-dark w-6 text-right">{s.PG}</span>
        <span className="text-mid-gray w-4 text-right">{s.J}</span>
        <span className="text-mid-gray w-4 text-right">{s.SG > 0 ? `+${s.SG}` : s.SG}</span>
        <LastGamesDots results={s.lastGames} compact />
      </div>
    </div>
  )
}

function LastGamesDots({
  results,
  compact = false,
}: {
  results: ('W' | 'D' | 'L')[]
  compact?: boolean
}) {
  const total = 3
  const dots: ('W' | 'D' | 'L' | null)[] = [
    ...Array(Math.max(0, total - results.length)).fill(null),
    ...results.slice(-total),
  ]

  return (
    <div className="flex items-center gap-1 justify-center">
      {dots.map((r, i) => (
        <span
          key={i}
          className={`rounded-full ${compact ? 'w-2 h-2' : 'w-3 h-3'} ${
            r === 'W' ? 'bg-green-500' :
            r === 'D' ? 'bg-mid-gray' :
            r === 'L' ? 'bg-red-500' :
            'border border-light-gray'
          }`}
        />
      ))}
    </div>
  )
}

function KnockoutPhaseTable({ phase, games }: { phase: MatchPhase; games: Match[] }) {
  return (
    <div className="bg-white rounded-2xl border border-light-gray overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-dark">
        <h2 className="text-sm font-bold text-white">{PHASE_LABELS[phase] ?? phase}</h2>
        <Link href="/jogos" className="text-xs text-primary font-semibold hover:underline">
          Ver jogos →
        </Link>
      </div>
      <div className="divide-y divide-light-gray">
        {games.map((m) => (
          <div key={m.id} className="flex items-center gap-3 px-4 py-3">
            {/* Time 1 */}
            <div className="flex-1 flex items-center gap-2 justify-end">
              <span className="text-sm font-semibold text-dark text-right">{m.country1.name}</span>
              <CountryFlag flag={m.country1.flag} name={m.country1.name} size="sm" />
            </div>

            {/* Placar */}
            <div className="flex items-center gap-1 min-w-[64px] justify-center">
              {m.status === 'FINISHED' && m.scoreCountry1 != null && m.scoreCountry2 != null ? (
                <>
                  <span className="w-7 h-7 flex items-center justify-center rounded-md bg-dark text-white text-sm font-bold">{m.scoreCountry1}</span>
                  <span className="text-mid-gray text-xs font-bold">×</span>
                  <span className="w-7 h-7 flex items-center justify-center rounded-md bg-dark text-white text-sm font-bold">{m.scoreCountry2}</span>
                </>
              ) : (
                <span className="text-xs text-mid-gray font-semibold">{m.matchTime ? `${m.matchTime}` : 'vs'}</span>
              )}
            </div>

            {/* Time 2 */}
            <div className="flex-1 flex items-center gap-2">
              <CountryFlag flag={m.country2.flag} name={m.country2.name} size="sm" />
              <span className="text-sm font-semibold text-dark">{m.country2.name}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Legend() {
  return (
    <div className="bg-white rounded-2xl border border-light-gray p-4">
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-mid-gray">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> vitória</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> derrota</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-mid-gray inline-block" /> empate</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full border border-light-gray inline-block" /> futuro</span>
        <span className="ml-auto text-xs">· <span className="font-semibold">PG</span> pontos · <span className="font-semibold">J</span> jogos · <span className="font-semibold">V</span> vitórias · <span className="font-semibold">E</span> empates · <span className="font-semibold">D</span> derrotas · <span className="font-semibold">GP</span> gols pró · <span className="font-semibold">GC</span> gols contra · <span className="font-semibold">SG</span> saldo · <span className="font-semibold">%</span> aproveitamento</span>
      </div>
      <p className="text-xs text-green-700 mt-3 font-medium">🟢 Fundo verde = classificados para as oitavas (1º e 2º de cada grupo)</p>
    </div>
  )
}
