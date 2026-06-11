'use client'

import { use } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { DaisyMarkdown } from '@/components/features/DaisyMarkdown'
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
    return format(parseISO(iso), "d 'de' MMMM 'de' yyyy", { locale: ptBR })
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

  const dateLabel = diary.date
    ? formatDate(diary.date)
    : formatDate(diary.createdAt)

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-10">

      {/* Voltar */}
      <Link href="/daisy" className="flex items-center gap-1 text-sm text-mid-gray hover:text-dark transition-colors">
        ← Diário da Daisy
      </Link>

      {/* ── Hero — identidade da Daisy ─────────────────────────────────────── */}
      <div className="relative bg-dark rounded-2xl overflow-hidden">
        {/* Fundo gradiente decorativo */}
        <div className="absolute inset-0 bg-gradient-to-br from-violet-900/40 via-dark to-dark pointer-events-none" />
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />

        <div className="relative p-6">
          {/* Linha superior: avatar + badges */}
          <div className="flex items-start gap-4 mb-5">
            <DaisyAvatarLarge />
            <div className="flex-1 pt-1">
              <div className="flex flex-wrap gap-1.5 mb-2">
                <span className="inline-flex items-center gap-1 bg-violet-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  ⚡ IA DGT
                </span>
                <span className="inline-flex items-center gap-1 bg-white/10 text-white/70 text-[10px] font-medium px-2 py-0.5 rounded-full">
                  Consultora Virtual
                </span>
                <span className="inline-flex items-center gap-1 bg-white/10 text-white/70 text-[10px] font-medium px-2 py-0.5 rounded-full">
                  📡 Radar de Dados
                </span>
              </div>
              <p className="text-xs text-white/50">{dateLabel}</p>
            </div>
          </div>

          {/* Título e subtítulo */}
          <h1 className="text-xl font-bold text-white leading-snug mb-2">{diary.title}</h1>
          {diary.subtitle && (
            <p className="text-sm text-white/70 leading-relaxed">{diary.subtitle}</p>
          )}
        </div>
      </div>

      {/* ── Conteúdo em Markdown ────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-light-gray px-6 py-6">
        <DaisyMarkdown content={diary.content} />
      </div>

      {/* ── Rodapé ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-2 text-xs text-mid-gray pb-2">
        <span>🤖</span>
        <span>Gerado por Daisy · DGT Consultoria · DGT Predict 2026</span>
      </div>

    </div>
  )
}

// ─── Avatar grande da Daisy ────────────────────────────────────────────────────

function DaisyAvatarLarge() {
  return (
    <div className="relative shrink-0">
      <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/daisy.png" alt="Daisy" className="w-full h-full object-cover" />
      </div>
      {/* Pulse animado — indica que é IA ativa */}
      <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-primary rounded-full border-2 border-dark flex items-center justify-center">
        <span className="text-[8px]">✦</span>
      </span>
    </div>
  )
}
