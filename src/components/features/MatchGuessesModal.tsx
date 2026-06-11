'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { isGuessingClosed, formatMatchDate, PHASE_LABELS } from '@/lib/utils/dates'
import { CountryFlag } from './CountryFlag'
import type { Match } from '@/lib/types'

// ─── Tipos espelhados da rota server-side ──────────────────────────────────────
type GuessOutcome = 'EXACT_SCORE' | 'CORRECT_RESULT' | 'WRONG' | 'PENDING'

type MatchGuessParticipant = {
  guessId: string
  userId: string
  userName: string
  isDaisy: boolean
  result1: number
  result2: number
  points: number | null
  outcome: GuessOutcome
  createdAt: string
}

type MatchGuessesResponse = {
  matchId: string
  isFinished: boolean
  totalGuesses: number
  exactScores: number
  correctResults: number
  wrong: number
  participants: MatchGuessParticipant[]
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

function useMatchGuesses(matchId: string, enabled: boolean) {
  const { authHeader } = useAuth()
  return useQuery<MatchGuessesResponse>({
    queryKey: ['match-guesses', matchId],
    queryFn: async () => {
      const res = await fetch(`/api/matches/${matchId}/guesses`, { headers: authHeader() })
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(d.error ?? `Erro ${res.status}`)
      }
      return res.json()
    },
    enabled,
    staleTime: 60_000,
  })
}

// ─── Modal principal ──────────────────────────────────────────────────────────

interface MatchGuessesModalProps {
  match: Match
  isOpen: boolean
  onClose: () => void
}

export function MatchGuessesModal({ match, isOpen, onClose }: MatchGuessesModalProps) {
  const closed  = isGuessingClosed(match.matchDate, match.matchTime)
  const { data, isLoading, error } = useMatchGuesses(match.id, isOpen && closed)

  if (!isOpen) return null

  const hasResult = match.status === 'FINISHED' && match.scoreCountry1 != null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-t-2xl md:rounded-2xl overflow-hidden shadow-xl flex flex-col"
        style={{ maxHeight: '88vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="p-4 border-b border-light-gray flex-shrink-0">
          {/* Drag handle (mobile) */}
          <div className="w-10 h-1 bg-light-gray rounded-full mx-auto mb-3 md:hidden" />

          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-dark">
              {data?.isFinished ? 'Palpites e pontuação' : 'Palpites dos participantes'}
            </h2>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-full text-mid-gray hover:text-dark hover:bg-gray-100 transition-colors text-sm"
            >
              ✕
            </button>
          </div>

          {/* Confronto */}
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="flex items-center gap-1.5">
              <CountryFlag flag={match.country1.flag} name={match.country1.name} size="sm" />
              <span className="text-sm font-semibold text-dark">{match.country1.name}</span>
            </div>
            {hasResult ? (
              <div className="flex items-center gap-1 bg-dark text-white px-2.5 py-1 rounded-xl">
                <span className="text-sm font-bold">{match.scoreCountry1}</span>
                <span className="text-white/50 text-xs">×</span>
                <span className="text-sm font-bold">{match.scoreCountry2}</span>
              </div>
            ) : (
              <span className="text-sm font-bold text-light-gray px-2">vs</span>
            )}
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-dark">{match.country2.name}</span>
              <CountryFlag flag={match.country2.flag} name={match.country2.name} size="sm" />
            </div>
          </div>

          <p className="text-xs text-mid-gray text-center">
            {formatMatchDate(match.matchDate)} · {match.matchTime}
            {' · '}{PHASE_LABELS[match.phase] ?? match.phase}
            {match.group ? ` · Grupo ${match.group}` : ''}
          </p>

          {/* Stats summary */}
          {data && (
            <div className="mt-3 pt-3 border-t border-light-gray text-center">
              {data.isFinished ? (
                <p className="text-xs text-mid-gray">
                  <span className="font-semibold text-dark">{data.totalGuesses}</span> palpites
                  {data.exactScores > 0 && (
                    <> · <span className="font-semibold text-amber-700">{data.exactScores} 🎯 exatos</span></>
                  )}
                  {data.correctResults > 0 && (
                    <> · <span className="font-semibold text-green-700">{data.correctResults} ✅ certos</span></>
                  )}
                  {data.wrong > 0 && (
                    <> · <span className="text-gray-500">{data.wrong} erraram</span></>
                  )}
                </p>
              ) : (
                <p className="text-xs text-mid-gray">
                  <span className="font-semibold text-dark">{data.totalGuesses}</span> palpites registrados · Aguardando resultado
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Conteúdo ──────────────────────────────────────────────────────── */}
        <div className="overflow-y-auto flex-1 p-4">
          {!closed ? (
            <div className="text-center py-10">
              <p className="text-4xl mb-2">🔒</p>
              <p className="text-sm font-medium text-dark">Palpites protegidos</p>
              <p className="text-xs text-mid-gray mt-1">
                Os palpites serão liberados após o fechamento do jogo.
              </p>
            </div>
          ) : isLoading ? (
            <div className="flex flex-col items-center gap-2 py-10 text-mid-gray">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm">Carregando palpites...</p>
            </div>
          ) : error ? (
            <div className="text-center py-10">
              <p className="text-3xl mb-2">⚠️</p>
              <p className="text-sm font-medium text-dark">Não foi possível carregar os palpites.</p>
              <p className="text-xs text-mid-gray mt-1">
                {error instanceof Error ? error.message : 'Tente novamente.'}
              </p>
            </div>
          ) : !data || data.participants.length === 0 ? (
            <div className="text-center py-10 text-mid-gray">
              <p className="text-3xl mb-2">⚽</p>
              <p className="text-sm">Nenhum participante registrou palpite para este jogo.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.participants.map((p) => (
                <ParticipantRow key={p.guessId} participant={p} isFinished={data.isFinished} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Linha de participante ─────────────────────────────────────────────────────

function ParticipantRow({
  participant: p,
  isFinished,
}: {
  participant: MatchGuessParticipant
  isFinished: boolean
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 border border-light-gray/60">
      {/* Avatar */}
      <div className="shrink-0">
        {p.isDaisy ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/daisy.png" alt="Daisy" className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-dark flex items-center justify-center text-white text-xs font-bold select-none">
            {p.userName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Nome + badge */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium text-dark truncate">{p.userName}</span>
          {p.isDaisy && (
            <span className="text-[9px] font-bold bg-violet-600 text-white px-1.5 py-0.5 rounded-full shrink-0 leading-none">
              IA DGT
            </span>
          )}
        </div>
        {!isFinished && (
          <span className="text-[10px] text-mid-gray">Aguardando resultado</span>
        )}
      </div>

      {/* Placar palpitado */}
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-base font-bold text-dark tabular-nums">{p.result1}</span>
        <span className="text-mid-gray text-xs">×</span>
        <span className="text-base font-bold text-dark tabular-nums">{p.result2}</span>
      </div>

      {/* Badge de resultado */}
      {isFinished && <OutcomeBadge outcome={p.outcome} points={p.points} />}
    </div>
  )
}

function OutcomeBadge({ outcome, points }: { outcome: GuessOutcome; points: number | null }) {
  if (outcome === 'EXACT_SCORE') {
    return (
      <div className="shrink-0 flex flex-col items-center justify-center bg-amber-100 text-amber-800 rounded-lg px-2 py-1 min-w-[48px]">
        <span className="text-sm">🎯</span>
        <span className="text-[10px] font-bold leading-none">{points} pts</span>
      </div>
    )
  }
  if (outcome === 'CORRECT_RESULT') {
    return (
      <div className="shrink-0 flex flex-col items-center justify-center bg-green-100 text-green-800 rounded-lg px-2 py-1 min-w-[48px]">
        <span className="text-sm">✅</span>
        <span className="text-[10px] font-bold leading-none">{points} pts</span>
      </div>
    )
  }
  if (outcome === 'WRONG') {
    return (
      <div className="shrink-0 flex flex-col items-center justify-center bg-gray-100 text-gray-400 rounded-lg px-2 py-1 min-w-[48px]">
        <span className="text-sm">❌</span>
        <span className="text-[10px] font-bold leading-none">0 pts</span>
      </div>
    )
  }
  return null
}
