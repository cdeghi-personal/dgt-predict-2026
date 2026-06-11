'use client'

import { use } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { DaisyDiary } from '@/lib/types'

function useDiary(id: string) {
  const { authHeader, isAuthenticated } = useAuth()
  return useQuery<DaisyDiary>({
    queryKey: ['daisy-diary', id],
    queryFn: async () => {
      const res = await fetch(`/api/daisy/diary/${id}`, { headers: authHeader() })
      if (!res.ok) throw new Error('Entrada não encontrada.')
      return res.json()
    },
    enabled: isAuthenticated && !!id,
    staleTime: 60_000,
  })
}

function formatDate(iso: string) {
  try {
    return format(parseISO(iso), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: ptBR })
  } catch {
    return iso
  }
}

export default function DaisyEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: diary, isLoading, error } = useDiary(id)

  if (isLoading) return <PageLoader />

  if (error || !diary) {
    return (
      <div className="text-center py-16 text-mid-gray">
        <p className="text-4xl mb-3">📓</p>
        <p className="font-medium">Entrada não encontrada.</p>
        <Link href="/daisy" className="text-sm text-primary font-semibold mt-3 inline-block">
          ← Voltar ao diário
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      {/* Voltar */}
      <Link href="/daisy" className="flex items-center gap-1 text-sm text-mid-gray hover:text-dark transition-colors">
        ← Diário da Daisy
      </Link>

      {/* Header da entrada */}
      <div className="bg-dark rounded-2xl p-5 text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-lg">
            🤖
          </div>
          <div>
            <p className="text-sm font-bold">Daisy</p>
            <p className="text-xs text-white/60">{formatDate(diary.createdAt)}</p>
          </div>
        </div>
        <h1 className="text-xl font-bold leading-snug">{diary.title}</h1>
        {diary.subtitle && (
          <p className="text-sm text-white/70 mt-2">{diary.subtitle}</p>
        )}
      </div>

      {/* Conteúdo */}
      <div className="bg-white rounded-2xl border border-light-gray p-5">
        <div className="prose prose-sm max-w-none text-dark leading-relaxed whitespace-pre-wrap">
          {diary.content}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-mid-gray pb-4">
        Gerado por Daisy · DGT Predict 2026
      </div>
    </div>
  )
}
