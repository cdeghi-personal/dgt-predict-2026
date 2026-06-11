'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { CountryFlag } from '@/components/features/CountryFlag'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { useMatches } from '@/hooks/useMatches'
import { calculateGroupStandings } from '@/lib/standings'
import type { TeamStanding } from '@/lib/standings'

export default function ClassificacaoPage() {
  const { data: matches, isLoading } = useMatches()

  const standings = useMemo(
    () => (matches ? calculateGroupStandings(matches) : new Map()),
    [matches],
  )

  if (isLoading) return <PageLoader />

  if (standings.size === 0) {
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
        <p className="text-sm text-mid-gray">Fase de grupos · Copa do Mundo 2026</p>
      </div>

      {[...standings.entries()].map(([group, teams]) => (
        <GroupTable key={group} group={group} teams={teams} />
      ))}

      <Legend />
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
