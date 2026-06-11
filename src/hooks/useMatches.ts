'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import type { Match } from '@/lib/types'

async function fetchMatches(
  headers: Record<string, string>,
  params?: { date?: string; phase?: string },
): Promise<Match[]> {
  const qs = new URLSearchParams()
  if (params?.date) qs.set('date', params.date)
  if (params?.phase) qs.set('phase', params.phase)

  const res = await fetch(`/api/matches?${qs}`, { headers })
  if (!res.ok) throw new Error('Erro ao buscar partidas.')
  return res.json()
}

export function useMatches(params?: { date?: string; phase?: string }) {
  const { authHeader, isAuthenticated } = useAuth()

  return useQuery({
    queryKey: ['matches', params],
    queryFn: () => fetchMatches(authHeader(), params),
    enabled: isAuthenticated,
    staleTime: 60_000,
  })
}

export function useTomorrowMatches() {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const dateStr = tomorrow.toISOString().split('T')[0]

  return useMatches({ date: dateStr })
}

export function useTodayMatches() {
  const today = new Date().toISOString().split('T')[0]
  return useMatches({ date: today })
}

async function fetchMatch(id: string, headers: Record<string, string>): Promise<Match> {
  const res = await fetch(`/api/matches/${id}`, { headers })
  if (!res.ok) throw new Error('Partida não encontrada.')
  return res.json()
}

export function useMatch(id: string) {
  const { authHeader, isAuthenticated } = useAuth()

  return useQuery({
    queryKey: ['match', id],
    queryFn: () => fetchMatch(id, authHeader()),
    enabled: isAuthenticated && !!id,
    staleTime: 60_000,
  })
}
