'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { DaisyDiary } from '@/lib/types'

function useDaisyDiaries() {
  const { authHeader, isAuthenticated } = useAuth()
  return useQuery<DaisyDiary[]>({
    queryKey: ['daisy-diaries'],
    queryFn: async () => {
      const res = await fetch('/api/daisy/diary', { headers: authHeader() })
      if (!res.ok) throw new Error('Erro ao buscar diário.')
      return res.json()
    },
    enabled: isAuthenticated,
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

function formatDateTime(iso: string) {
  try {
    return format(parseISO(iso), "d 'de' MMMM 'de' yyyy '·' HH:mm", { locale: ptBR })
  } catch {
    return iso
  }
}

export default function DaisyPage() {
  const { data: diaries, isLoading } = useDaisyDiaries()

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-6 max-w-2xl mx-auto">

      {/* ── Header da Daisy ────────────────────────────────────────────────── */}
      <div className="bg-dark rounded-2xl p-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl overflow-hidden shadow shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/daisy.png" alt="Daisy" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            <span className="inline-flex items-center gap-1 bg-violet-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              ⚡ IA DGT
            </span>
            <span className="inline-flex items-center gap-1 bg-white/10 text-white/70 text-[10px] px-2 py-0.5 rounded-full">
              📡 Radar de Dados
            </span>
          </div>
          <h1 className="text-lg font-bold text-white leading-tight">Diário da Daisy</h1>
          <p className="text-xs text-white/50 mt-0.5">Análises e palpites da consultora virtual da DGT</p>
        </div>
      </div>

      {/* ── Lista de entradas ──────────────────────────────────────────────── */}
      {!diaries || diaries.length === 0 ? (
        <div className="text-center py-16 text-mid-gray">
          <p className="text-4xl mb-3">📓</p>
          <p className="font-medium">Nenhuma entrada no diário ainda.</p>
          <p className="text-sm">A Daisy vai começar a escrever em breve!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {diaries.map((diary, i) => (
            <DiaryCard key={diary.id} diary={diary} featured={i === 0} />
          ))}
        </div>
      )}

    </div>
  )
}

function DiaryCard({ diary, featured }: { diary: DaisyDiary; featured?: boolean }) {
  const dateLabel = diary.date ? formatDate(diary.date) : formatDate(diary.createdAt)
  const generatedAt = formatDateTime(diary.createdAt)

  return (
    <Link href={`/daisy/${diary.id}`}>
      <div className={`bg-white rounded-2xl border transition-all hover:shadow-md hover:-translate-y-0.5 ${featured ? 'border-violet-200 shadow-sm' : 'border-light-gray'} p-4`}>
        <div className="flex items-start justify-between gap-2 mb-2">
          {featured ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">
              ✨ Mais recente
            </span>
          ) : (
            <span className="text-xs text-mid-gray">{dateLabel}</span>
          )}
          <span className="text-[10px] font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-full shrink-0">
            IA DGT
          </span>
        </div>

        <h2 className="text-base font-bold text-dark leading-snug">{diary.title}</h2>
        {diary.subtitle && (
          <p className="text-sm text-mid-gray mt-1 line-clamp-2">{diary.subtitle}</p>
        )}

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-light-gray">
          <span className="text-[10px] text-mid-gray/70">Gerado em {generatedAt}</span>
          <span className="text-xs text-primary font-semibold">Ler edição →</span>
        </div>
      </div>
    </Link>
  )
}
