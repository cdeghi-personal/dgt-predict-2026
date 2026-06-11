'use client'

import { clsx } from 'clsx'
import { useAuth } from '@/contexts/AuthContext'
import type { RankingEntry } from '@/lib/types'

interface RankingTableProps {
  entries: RankingEntry[]
  topOnly?: number
}

const MEDAL = ['🥇', '🥈', '🥉']

export function RankingTable({ entries, topOnly }: RankingTableProps) {
  const { user } = useAuth()
  const displayed = topOnly ? entries.slice(0, topOnly) : entries

  if (displayed.length === 0) {
    return (
      <div className="text-center py-8 text-mid-gray text-sm">
        Nenhum palpite computado ainda.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-light-gray">
      {/* Header */}
      <div className="hidden md:grid grid-cols-[40px_1fr_80px_80px_80px] gap-2 px-4 py-2 bg-background border-b border-light-gray">
        <span className="text-xs font-semibold text-mid-gray text-center">#</span>
        <span className="text-xs font-semibold text-mid-gray">Participante</span>
        <span className="text-xs font-semibold text-mid-gray text-center">Pts</span>
        <span className="text-xs font-semibold text-mid-gray text-center">🎯 Exatos</span>
        <span className="text-xs font-semibold text-mid-gray text-center">✅ Certos</span>
      </div>

      {/* Rows */}
      {displayed.map((entry) => {
        const isMe = entry.userId === user?.id
        const medal = MEDAL[entry.position - 1]

        return (
          <div
            key={entry.userId}
            className={clsx(
              'grid grid-cols-[40px_1fr_60px] md:grid-cols-[40px_1fr_80px_80px_80px] gap-2 px-4 py-3 border-b border-light-gray last:border-b-0',
              isMe ? 'bg-amber-50' : 'bg-surface hover:bg-background',
            )}
          >
            {/* Posição */}
            <div className="flex items-center justify-center">
              {medal ? (
                <span className="text-lg">{medal}</span>
              ) : (
                <span className="text-sm font-bold text-mid-gray">{entry.position}</span>
              )}
            </div>

            {/* Nome */}
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-dark flex items-center justify-center text-white text-xs font-bold shrink-0">
                {entry.userName?.[0]?.toUpperCase() ?? '?'}
              </div>
              <span className={clsx('text-sm font-medium truncate', isMe ? 'text-amber-700 font-bold' : 'text-dark')}>
                {entry.userName} {isMe && '(você)'}
              </span>
            </div>

            {/* Pontos */}
            <div className="flex items-center justify-center">
              <span className={clsx('text-sm font-bold', isMe ? 'text-amber-700' : 'text-dark')}>
                {entry.totalPoints}
              </span>
            </div>

            {/* Exatos — só desktop */}
            <div className="hidden md:flex items-center justify-center">
              <span className="text-sm text-dark">{entry.exactScores}</span>
            </div>

            {/* Certos — só desktop */}
            <div className="hidden md:flex items-center justify-center">
              <span className="text-sm text-dark">{entry.correctResults}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
