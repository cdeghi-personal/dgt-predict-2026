'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { RankingTable } from '@/components/features/RankingTable'
import { MatchCard } from '@/components/features/MatchCard'
import { GuessForm } from '@/components/features/GuessForm'
import { useAuth } from '@/contexts/AuthContext'
import { useRanking } from '@/hooks/useRanking'
import { useTomorrowMatches, useTodayMatches } from '@/hooks/useMatches'
import { useMyGuesses, useMatchDistributions } from '@/hooks/useGuesses'
import { isGuessingClosed } from '@/lib/utils/dates'
import { calculatePoints } from '@/lib/utils/scoring'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Match, RankingEntry, DaisyDiary } from '@/lib/types'

function useLatestDiary() {
  const { authHeader, isAuthenticated } = useAuth()
  return useQuery<DaisyDiary[], Error, DaisyDiary | null>({
    queryKey: ['daisy-diaries'],
    queryFn: async () => {
      const res = await fetch('/api/daisy/diary', { headers: authHeader() })
      if (!res.ok) return []
      return res.json() as Promise<DaisyDiary[]>
    },
    enabled: isAuthenticated,
    staleTime: 120_000,
    select: (data: DaisyDiary[]) => data[0] ?? null,
  })
}

export default function DashboardPage() {
  const { user } = useAuth()
  const { data: ranking, isLoading: rankingLoading } = useRanking()
  const { data: tomorrowMatches } = useTomorrowMatches()
  const { data: todayMatches } = useTodayMatches()
  const { data: myGuesses } = useMyGuesses()
  const { data: latestDiary } = useLatestDiary()
  const [guessingMatch, setGuessingMatch] = useState<Match | null>(null)

  const myRankEntry = ranking?.find((r) => r.userId === user?.id)
  const guessMap = new Map(myGuesses?.map((g) => [g.matchId, g]))
  const pendingTomorrow = tomorrowMatches?.filter((m) => !guessMap.has(m.id)) ?? []
  const upcomingMatches = [...(todayMatches ?? []), ...(tomorrowMatches ?? [])].slice(0, 3)

  const closedUpcomingIds = upcomingMatches
    .filter((m) => isGuessingClosed(m.matchDate, m.matchTime))
    .map((m) => m.id)
  const { data: distributions } = useMatchDistributions(closedUpcomingIds)

  return (
    <div className="space-y-6">

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <div className="relative rounded-2xl overflow-hidden bg-dark text-white p-6">
        <div className="absolute top-0 right-0 w-48 h-full bg-gradient-to-l from-primary/20 to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-secondary to-primary" />

        <div className="flex items-start justify-between">
          <div>
            <p className="text-white/60 text-sm mb-1">Copa do Mundo FIFA 2026</p>
            <h1 className="text-2xl font-bold">
              Olá, {user?.name?.split(' ')[0]} 👋
            </h1>
            {myRankEntry ? (
              <p className="text-white/70 text-sm mt-1">
                Você está em <span className="text-primary font-bold">#{myRankEntry.position}º lugar</span> com {myRankEntry.totalPoints} pontos
              </p>
            ) : (
              <p className="text-white/60 text-sm mt-1">Registre seus palpites e dispute o bolão!</p>
            )}
          </div>
          <span className="text-5xl select-none">⚽</span>
        </div>

        {myRankEntry && (
          <div className="grid grid-cols-3 gap-3 mt-5">
            <HeroStat label="Pontos" value={String(myRankEntry.totalPoints)} accent />
            <HeroStat label="🎯 Exatos" value={String(myRankEntry.exactScores)} />
            <HeroStat label="✅ Certos" value={String(myRankEntry.correctResults)} />
          </div>
        )}
      </div>

      {/* ── Banner: palpites pendentes amanhã ──────────────────────────── */}
      {pendingTomorrow.length > 0 && (
        <div className="flex items-center justify-between bg-primary/10 border border-primary/30 rounded-2xl px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⏰</span>
            <div>
              <p className="text-sm font-bold text-dark">Palpites pendentes para amanhã</p>
              <p className="text-xs text-mid-gray">
                {pendingTomorrow.length} jogo{pendingTomorrow.length > 1 ? 's' : ''} sem palpite
              </p>
            </div>
          </div>
          <Link href="/jogos">
            <Button variant="primary" size="sm">Palpitar</Button>
          </Link>
        </div>
      )}

      {/* ── Próximos jogos ─────────────────────────────────────────────── */}
      {upcomingMatches.length > 0 && (
        <section>
          <SectionHeader title="Próximos Jogos" href="/jogos" linkLabel="Ver todos →" />
          <div className="space-y-3">
            {upcomingMatches.map((match) => {
              const raw = guessMap.get(match.id) ?? null
              const guess = raw && match.status === 'FINISHED' && match.scoreCountry1 != null && match.scoreCountry2 != null
                ? { ...raw, points: calculatePoints(raw.result1, raw.result2, match.scoreCountry1, match.scoreCountry2).points }
                : raw
              return (
                <div key={match.id}>
                  {guessingMatch?.id === match.id ? (
                    <GuessForm match={match} existingGuess={guess} onClose={() => setGuessingMatch(null)} />
                  ) : (
                    <MatchCard match={match} guess={guess} onGuess={() => setGuessingMatch(match)} guessDistribution={distributions?.[match.id] ?? null} />
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Diário da Daisy ────────────────────────────────────────────── */}
      {latestDiary && (
        <section>
          <SectionHeader title="📓 Diário da Daisy" href="/daisy" linkLabel="Ver todos →" />
          <DaisyCard diary={latestDiary} />
        </section>
      )}

      {/* ── Ranking ────────────────────────────────────────────────────── */}
      <section>
        <SectionHeader title="🏆 Top 10 Ranking" href="/ranking" linkLabel="Ver completo →" />
        {rankingLoading ? (
          <RankingSkeleton />
        ) : (ranking ?? []).length > 0 ? (
          <div className="bg-white rounded-2xl border border-light-gray overflow-hidden">
            <RankingTable entries={ranking ?? []} topOnly={10} />
          </div>
        ) : (
          <EmptyState
            emoji="🏆"
            title="Ranking ainda vazio"
            description="Os palpites computados vão aparecer aqui após os primeiros resultados."
          />
        )}
      </section>

      {/* ── Destaques ──────────────────────────────────────────────────── */}
      {(ranking ?? []).length > 0 && (
        <section>
          <SectionHeader title="⭐ Destaques" />
          <Highlights ranking={ranking ?? []} currentUserId={user?.id} />
        </section>
      )}

    </div>
  )
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function DaisyCard({ diary }: { diary: DaisyDiary }) {
  const dateLabel = (() => {
    try { return format(parseISO(diary.createdAt), "d 'de' MMMM", { locale: ptBR }) }
    catch { return '' }
  })()

  return (
    <Link href={`/daisy/${diary.id}`}>
      <div className="bg-white rounded-2xl border border-light-gray hover:shadow-md transition-shadow p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center text-lg shrink-0">
          🤖
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-xs font-bold text-violet-700">Daisy IA</span>
            {dateLabel && <span className="text-xs text-mid-gray">{dateLabel}</span>}
          </div>
          <p className="text-sm font-bold text-dark leading-snug line-clamp-1">{diary.title}</p>
          {diary.subtitle && (
            <p className="text-xs text-mid-gray mt-0.5 line-clamp-2">{diary.subtitle}</p>
          )}
        </div>
        <span className="text-primary text-xs font-semibold shrink-0">→</span>
      </div>
    </Link>
  )
}

function HeroStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl p-3 text-center ${accent ? 'bg-primary text-dark' : 'bg-white/10 text-white'}`}>
      <p className={`text-xl font-bold ${accent ? 'text-dark' : 'text-white'}`}>{value}</p>
      <p className={`text-xs mt-0.5 ${accent ? 'text-dark/70' : 'text-white/60'}`}>{label}</p>
    </div>
  )
}

function SectionHeader({ title, href, linkLabel }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-bold text-dark uppercase tracking-wide">{title}</h2>
      {href && linkLabel && (
        <Link href={href} className="text-xs text-primary font-semibold hover:underline">
          {linkLabel}
        </Link>
      )}
    </div>
  )
}

function EmptyState({ emoji, title, description }: { emoji: string; title: string; description: string }) {
  return (
    <div className="bg-white rounded-2xl border border-light-gray text-center py-10 px-4">
      <p className="text-4xl mb-2">{emoji}</p>
      <p className="font-semibold text-dark">{title}</p>
      <p className="text-sm text-mid-gray mt-1">{description}</p>
    </div>
  )
}

function RankingSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-light-gray overflow-hidden divide-y divide-light-gray">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
          <div className="w-6 h-4 bg-light-gray rounded" />
          <div className="w-8 h-8 bg-light-gray rounded-full" />
          <div className="flex-1 h-4 bg-light-gray rounded" />
          <div className="w-12 h-4 bg-light-gray rounded" />
        </div>
      ))}
    </div>
  )
}

function Highlights({ ranking, currentUserId }: { ranking: RankingEntry[]; currentUserId?: string }) {
  const leader = ranking[0]
  const topExact = [...ranking].sort((a, b) => b.exactScores - a.exactScores)[0]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <HighlightCard
        emoji="🥇"
        label="Líder Geral"
        name={leader.userName}
        detail={`${leader.totalPoints} pontos`}
        isMe={leader.userId === currentUserId}
      />
      <HighlightCard
        emoji="🎯"
        label="Mais Placares Exatos"
        name={topExact.userName}
        detail={`${topExact.exactScores} acertos`}
        isMe={topExact.userId === currentUserId}
      />
    </div>
  )
}

function HighlightCard({ emoji, label, name, detail, isMe }: {
  emoji: string; label: string; name: string; detail: string; isMe?: boolean
}) {
  return (
    <div className={`flex items-center gap-3 bg-white rounded-2xl border p-4 ${isMe ? 'border-primary/50 bg-primary/5' : 'border-light-gray'}`}>
      <span className="text-3xl">{emoji}</span>
      <div className="min-w-0">
        <p className="text-xs text-mid-gray">{label}</p>
        <p className={`font-bold truncate ${isMe ? 'text-primary' : 'text-dark'}`}>
          {name} {isMe && <span className="text-xs font-normal">(você)</span>}
        </p>
        <p className="text-xs text-mid-gray">{detail}</p>
      </div>
    </div>
  )
}
