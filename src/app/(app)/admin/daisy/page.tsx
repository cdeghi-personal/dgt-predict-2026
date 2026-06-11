'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { useAuth } from '@/contexts/AuthContext'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { DaisyDiary } from '@/lib/types'

function useAdminDiaries() {
  const { authHeader } = useAuth()
  return useQuery<DaisyDiary[]>({
    queryKey: ['admin-daisy-diaries'],
    queryFn: async () => {
      const res = await fetch('/api/admin/daisy', { headers: authHeader() })
      if (!res.ok) throw new Error('Erro ao buscar diários.')
      return res.json()
    },
    staleTime: 30_000,
  })
}

function formatDate(iso: string) {
  try {
    return format(parseISO(iso), "d/MM/yyyy HH:mm", { locale: ptBR })
  } catch {
    return iso
  }
}

export default function AdminDaisyPage() {
  const { user } = useAuth()
  const router = useRouter()
  const qc = useQueryClient()

  useEffect(() => {
    if (!user?.isAdmin) router.replace('/dashboard')
  }, [user, router])

  const { data: diaries, isLoading } = useAdminDiaries()
  const [newsText, setNewsText] = useState('')
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const { authHeader } = useAuth()

  const generate = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/daisy', {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({ newsText: newsText.trim() || undefined }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Erro ao gerar diário.')
      }
      return res.json() as Promise<DaisyDiary>
    },
    onSuccess: (diary) => {
      qc.invalidateQueries({ queryKey: ['admin-daisy-diaries'] })
      qc.invalidateQueries({ queryKey: ['daisy-diaries'] })
      setNewsText('')
      setGenerateError(null)
      setSuccessMsg(`Diário gerado: "${diary.title}"`)
      setTimeout(() => setSuccessMsg(null), 5000)
    },
    onError: (err) => {
      setGenerateError(err instanceof Error ? err.message : 'Erro.')
    },
  })

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const res = await fetch('/api/admin/daisy', {
        method: 'PATCH',
        headers: authHeader(),
        body: JSON.stringify({ id, active }),
      })
      if (!res.ok) throw new Error('Erro ao atualizar.')
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-daisy-diaries'] })
      qc.invalidateQueries({ queryKey: ['daisy-diaries'] })
    },
  })

  if (!user?.isAdmin) return null
  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-dark">Admin — Diário da Daisy</h1>
        <p className="text-sm text-mid-gray">{diaries?.length ?? 0} entradas no diário</p>
      </div>

      {/* Painel de geração */}
      <Card className="p-4 space-y-3">
        <h2 className="text-sm font-bold text-dark">Gerar Nova Entrada</h2>
        <div>
          <label className="text-xs font-medium text-mid-gray block mb-1">
            Contexto de notícias (opcional)
          </label>
          <textarea
            value={newsText}
            onChange={(e) => setNewsText(e.target.value)}
            placeholder="Cole aqui notícias do dia sobre futebol para enriquecer o diário..."
            rows={4}
            className="w-full rounded-xl border border-light-gray px-3 py-2 text-sm text-dark placeholder:text-mid-gray focus:outline-none focus:border-primary resize-none"
          />
          <p className="text-xs text-mid-gray mt-1">
            Deixe vazio para gerar apenas com dados de jogos e ranking.
          </p>
        </div>

        {generateError && (
          <p className="text-xs text-red-500 font-medium">{generateError}</p>
        )}
        {successMsg && (
          <p className="text-xs text-green-600 font-medium">✅ {successMsg}</p>
        )}

        <Button
          variant="primary"
          fullWidth
          loading={generate.isPending}
          onClick={() => generate.mutate()}
        >
          🤖 Gerar Diário com IA
        </Button>
      </Card>

      {/* Lista de entradas */}
      {diaries && diaries.length > 0 && (
        <section>
          <h2 className="text-xs font-bold text-mid-gray uppercase tracking-wide mb-3">
            Entradas do Diário
          </h2>
          <div className="space-y-3">
            {diaries.map((diary) => (
              <DiaryAdminCard
                key={diary.id}
                diary={diary}
                onToggle={(active) => toggle.mutate({ id: diary.id, active })}
                toggling={toggle.isPending}
              />
            ))}
          </div>
        </section>
      )}

      {diaries?.length === 0 && (
        <div className="text-center py-10 text-mid-gray">
          <p className="text-3xl mb-2">📓</p>
          <p className="font-medium text-sm">Nenhuma entrada ainda.</p>
          <p className="text-xs">Gere a primeira entrada acima.</p>
        </div>
      )}
    </div>
  )
}

function DiaryAdminCard({
  diary,
  onToggle,
  toggling,
}: {
  diary: DaisyDiary
  onToggle: (active: boolean) => void
  toggling: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge color={diary.active ? 'green' : 'gray'}>{diary.active ? 'Ativo' : 'Inativo'}</Badge>
            <span className="text-xs text-mid-gray">{formatDate(diary.createdAt)}</span>
          </div>
          <h3 className="text-sm font-bold text-dark truncate">{diary.title}</h3>
          {diary.subtitle && (
            <p className="text-xs text-mid-gray mt-0.5 truncate">{diary.subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-xs text-mid-gray underline hover:text-dark"
          >
            {expanded ? 'Fechar' : 'Ver'}
          </button>
          <button
            onClick={() => onToggle(!diary.active)}
            disabled={toggling}
            className={`text-xs underline hover:text-dark disabled:opacity-50 ${diary.active ? 'text-red-500' : 'text-green-600'}`}
          >
            {diary.active ? 'Desativar' : 'Ativar'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-light-gray">
          <p className="text-sm text-dark leading-relaxed whitespace-pre-wrap">{diary.content}</p>
        </div>
      )}
    </Card>
  )
}
