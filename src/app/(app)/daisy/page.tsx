'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import Image from 'next/image'
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

export default function DaisyPage() {
  const { data: diaries, isLoading } = useDaisyDiaries()

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-dark flex items-center justify-center text-2xl shrink-0 overflow-hidden">
          <DaisyAvatar />
        </div>
        <div>
          <h1 className="text-xl font-bold text-dark">Diário da Daisy</h1>
          <p className="text-sm text-mid-gray">Análises e palpites da consultora virtual da DGT</p>
        </div>
      </div>

      {/* Lista de entradas */}
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
  return (
    <Link href={`/daisy/${diary.id}`}>
      <div className={`bg-white rounded-2xl border transition-shadow hover:shadow-md ${featured ? 'border-primary/40 shadow-sm' : 'border-light-gray'} p-4`}>
        {featured && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary uppercase tracking-wide mb-2">
            ✨ Mais recente
          </span>
        )}
        <h2 className="text-base font-bold text-dark leading-snug">{diary.title}</h2>
        {diary.subtitle && (
          <p className="text-sm text-mid-gray mt-1 line-clamp-2">{diary.subtitle}</p>
        )}
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-mid-gray">{formatDate(diary.createdAt)}</span>
          <span className="text-xs text-primary font-semibold">Ler mais →</span>
        </div>
      </div>
    </Link>
  )
}

function DaisyAvatar() {
  return (
    <span className="text-2xl select-none">🤖</span>
  )
}
