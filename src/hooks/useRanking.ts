'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import type { RankingEntry } from '@/lib/types'

async function fetchRanking(headers: Record<string, string>): Promise<RankingEntry[]> {
  const res = await fetch('/api/ranking', { headers })
  if (!res.ok) throw new Error('Erro ao buscar ranking.')
  return res.json()
}

export function useRanking() {
  const { authHeader, isAuthenticated } = useAuth()

  return useQuery({
    queryKey: ['ranking'],
    queryFn: () => fetchRanking(authHeader()),
    enabled: isAuthenticated,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000, // atualiza a cada 5 min
  })
}
