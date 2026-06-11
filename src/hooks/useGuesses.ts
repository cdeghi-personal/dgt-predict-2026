'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import type { Guess } from '@/lib/types'

async function fetchGuesses(
  headers: Record<string, string>,
  params: { userId?: string; matchId?: string },
): Promise<Guess[]> {
  const qs = new URLSearchParams()
  if (params.userId) qs.set('userId', params.userId)
  if (params.matchId) qs.set('matchId', params.matchId)

  const res = await fetch(`/api/guesses?${qs}`, { headers })
  if (!res.ok) throw new Error('Erro ao buscar palpites.')
  return res.json()
}

export function useMyGuesses() {
  const { authHeader, isAuthenticated, user } = useAuth()

  return useQuery({
    queryKey: ['guesses', 'mine', user?.id],
    queryFn: () => fetchGuesses(authHeader(), { userId: user!.id }),
    enabled: isAuthenticated && !!user?.id,
    staleTime: 30_000,
  })
}

export function useMatchGuesses(matchId: string) {
  const { authHeader, isAuthenticated } = useAuth()

  return useQuery({
    queryKey: ['guesses', 'match', matchId],
    queryFn: () => fetchGuesses(authHeader(), { matchId }),
    enabled: isAuthenticated && !!matchId,
    staleTime: 30_000,
  })
}

interface CreateGuessPayload {
  matchId: string
  result1: number
  result2: number
}

export function useCreateGuess() {
  const { authHeader, user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (payload: CreateGuessPayload) => {
      const res = await fetch('/api/guesses', {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({ ...payload, userId: user!.id }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Erro ao criar palpite.')
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guesses', 'mine'] })
    },
  })
}

interface UpdateGuessPayload {
  id: string
  result1: number
  result2: number
}

export function useUpdateGuess() {
  const { authHeader } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, result1, result2 }: UpdateGuessPayload) => {
      const res = await fetch(`/api/guesses/${id}`, {
        method: 'PUT',
        headers: authHeader(),
        body: JSON.stringify({ result1, result2 }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Erro ao atualizar palpite.')
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guesses', 'mine'] })
    },
  })
}
