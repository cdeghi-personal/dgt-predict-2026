'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { useAuth } from '@/contexts/AuthContext'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { DaisyDiary } from '@/lib/types'
import type { DaisyAITestResult, GenerateDiaryResult, GenerateGuessesResult } from '@/lib/daisy/types'

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

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export default function AdminDaisyPage() {
  const { user, authHeader } = useAuth()
  const router = useRouter()
  const qc = useQueryClient()

  useEffect(() => {
    if (!user?.isAdmin) router.replace('/dashboard')
  }, [user, router])

  const { data: diaries, isLoading } = useAdminDiaries()

  // ── Card 1: Diagnóstico ─────────────────────────────────────────────────────
  const [testResult, setTestResult] = useState<DaisyAITestResult | null>(null)

  const testAI = useMutation({
    mutationFn: async () => {
      setTestResult(null)
      const res = await fetch('/api/admin/daisy/test-ai', {
        method: 'POST',
        headers: authHeader(),
      })
      return res.json() as Promise<DaisyAITestResult>
    },
    onSuccess: (data) => setTestResult(data),
    onError: (err) => {
      setTestResult({
        success: false,
        provider: 'OpenAI',
        model: 'gpt-4.1',
        error: err instanceof Error ? err.message : 'Erro desconhecido.',
      })
    },
  })

  // ── Card 2: Geração ─────────────────────────────────────────────────────────
  const [generateResult, setGenerateResult] = useState<GenerateDiaryResult | null>(null)
  const [generateError, setGenerateError] = useState<string | null>(null)

  const generate = useMutation({
    mutationFn: async () => {
      setGenerateResult(null)
      setGenerateError(null)
      const res = await fetch('/api/admin/daisy/generate-diary', {
        method: 'POST',
        headers: authHeader(),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Erro ao gerar diário.')
      }
      return res.json() as Promise<GenerateDiaryResult>
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['admin-daisy-diaries'] })
      qc.invalidateQueries({ queryKey: ['daisy-diaries'] })
      setGenerateResult(data)
    },
    onError: (err) => {
      setGenerateError(err instanceof Error ? err.message : 'Erro ao gerar diário.')
    },
  })

  // ── Card 3: Palpites da Daisy ───────────────────────────────────────────────
  const [guessesResult, setGuessesResult] = useState<GenerateGuessesResult | null>(null)
  const [guessesError, setGuessesError] = useState<string | null>(null)

  const generateGuesses = useMutation({
    mutationFn: async () => {
      setGuessesResult(null)
      setGuessesError(null)
      const res = await fetch('/api/admin/daisy/generate-guesses', {
        method: 'POST',
        headers: authHeader(),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Erro ao gerar palpites.')
      }
      return res.json() as Promise<GenerateGuessesResult>
    },
    onSuccess: (data) => setGuessesResult(data),
    onError: (err) => setGuessesError(err instanceof Error ? err.message : 'Erro ao gerar palpites.'),
  })

  // ── Toggle ativo/inativo ────────────────────────────────────────────────────
  const [toggleError, setToggleError] = useState<string | null>(null)

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const res = await fetch('/api/admin/daisy', {
        method: 'PATCH',
        headers: authHeader(),
        body: JSON.stringify({ id, active }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(d.error ?? `Erro ao atualizar (${res.status}).`)
      }
    },
    onMutate: async ({ id, active }) => {
      await qc.cancelQueries({ queryKey: ['admin-daisy-diaries'] })
      const prev = qc.getQueryData<DaisyDiary[]>(['admin-daisy-diaries'])
      qc.setQueryData<DaisyDiary[]>(['admin-daisy-diaries'], (old) =>
        old?.map((d) => d.id === id ? { ...d, active } : d) ?? []
      )
      return { prev }
    },
    onSuccess: () => {
      setToggleError(null)
      qc.invalidateQueries({ queryKey: ['admin-daisy-diaries'] })
      qc.invalidateQueries({ queryKey: ['daisy-diaries'] })
    },
    onError: (err, _vars, context) => {
      if (context?.prev) qc.setQueryData(['admin-daisy-diaries'], context.prev)
      setToggleError(err instanceof Error ? err.message : 'Erro ao alterar status.')
      setTimeout(() => setToggleError(null), 6000)
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

      {/* ── Card 1: Diagnóstico ────────────────────────────────────────────── */}
      <Card className="p-4 space-y-3">
        <div>
          <h2 className="text-sm font-bold text-dark">🔌 Diagnóstico da Daisy</h2>
          <p className="text-xs text-mid-gray mt-0.5">
            Verifica se a Daisy consegue se comunicar com a IA (OpenAI gpt-4.1).
          </p>
        </div>

        <Button variant="secondary" fullWidth loading={testAI.isPending} onClick={() => testAI.mutate()}>
          Testar Conexão com IA
        </Button>

        {testAI.isPending && (
          <p className="text-xs text-mid-gray text-center">Daisy está verificando sua conexão com a IA...</p>
        )}

        {testResult && (
          <div className={`rounded-xl p-3 border text-sm ${testResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            {testResult.success ? (
              <>
                <p className="font-bold text-green-700 mb-1">✅ Conexão com IA funcionando</p>
                <p className="text-xs text-green-600 mb-2">Provedor: {testResult.provider} · Modelo: {testResult.model}</p>
                {testResult.message && (
                  <p className="text-xs text-dark italic border-t border-green-200 pt-2">&ldquo;{testResult.message}&rdquo;</p>
                )}
              </>
            ) : (
              <>
                <p className="font-bold text-red-700 mb-1">❌ Falha na conexão com IA</p>
                <p className="text-xs text-red-600">{testResult.error}</p>
              </>
            )}
          </div>
        )}
      </Card>

      {/* ── Card 2: Geração ────────────────────────────────────────────────── */}
      <Card className="p-4 space-y-3">
        <div>
          <h2 className="text-sm font-bold text-dark">📓 Processo diário da Daisy</h2>
          <p className="text-xs text-mid-gray mt-0.5">
            Busca notícias, analisa jogos e ranking, e gera uma nova entrada do diário em Markdown.
          </p>
        </div>

        <Button variant="primary" fullWidth loading={generate.isPending} onClick={() => generate.mutate()}>
          🤖 Gerar Diário da Daisy
        </Button>

        {generate.isPending && (
          <p className="text-xs text-mid-gray text-center">
            Daisy está processando dados e preparando o diário...
          </p>
        )}

        {generateError && (
          <div className="rounded-xl p-3 border bg-red-50 border-red-200">
            <p className="text-xs font-bold text-red-700 mb-1">❌ Erro na geração</p>
            <p className="text-xs text-red-600">{generateError}</p>
          </div>
        )}

        {generateResult && (
          <div className="rounded-xl p-3 border bg-green-50 border-green-200 space-y-3">
            <p className="font-bold text-green-700 text-sm">✅ Diário gerado com sucesso!</p>

            {/* Dados do diário */}
            <div className="text-xs text-dark space-y-0.5">
              <p><span className="font-semibold text-mid-gray">Título:</span> {generateResult.diary.title}</p>
              {generateResult.diary.subtitle && (
                <p><span className="font-semibold text-mid-gray">Subtítulo:</span> {generateResult.diary.subtitle}</p>
              )}
              <p><span className="font-semibold text-mid-gray">Data:</span> {formatDate(generateResult.diary.createdAt)}</p>
            </div>

            {/* Estatísticas */}
            <div className="grid grid-cols-3 gap-2">
              <StatCell label="Notícias" value={String(generateResult.newsAnalyzed)} />
              <StatCell label="Jogos" value={String(generateResult.gamesConsidered)} />
              <StatCell label="Tempo" value={formatMs(generateResult.executionMs)} />
            </div>

            {/* Botão visualizar */}
            <Link href={`/daisy/${generateResult.diary.id}`}>
              <Button variant="secondary" fullWidth>
                Visualizar Diário →
              </Button>
            </Link>
          </div>
        )}
      </Card>

      {/* ── Card 3: Palpites da Daisy ─────────────────────────────────────── */}
      <Card className="p-4 space-y-3">
        <div>
          <h2 className="text-sm font-bold text-dark">🎯 Palpites da Daisy</h2>
          <p className="text-xs text-mid-gray mt-0.5">
            Consulta notícias, analisa os jogos das próximas 24h e registra os palpites da Daisy no bolão.
          </p>
        </div>

        <Button variant="secondary" fullWidth loading={generateGuesses.isPending} onClick={() => generateGuesses.mutate()}>
          🤖 Gerar Palpites da Daisy
        </Button>

        {generateGuesses.isPending && (
          <p className="text-xs text-mid-gray text-center">Daisy está analisando os jogos e as notícias...</p>
        )}

        {guessesError && (
          <div className="rounded-xl p-3 border bg-red-50 border-red-200">
            <p className="text-xs font-bold text-red-700 mb-1">❌ Erro na geração</p>
            <p className="text-xs text-red-600">{guessesError}</p>
          </div>
        )}

        {guessesResult && (
          <div className="rounded-xl p-3 border bg-green-50 border-green-200 space-y-3">
            {guessesResult.gamesFound === 0 ? (
              <p className="text-sm text-amber-700 font-medium">⚠️ Nenhum jogo nas próximas 24h.</p>
            ) : (
              <>
                <p className="font-bold text-green-700 text-sm">
                  ✅ {guessesResult.guesses.length} palpite(s) registrado(s)!
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <StatCell label="Jogos" value={String(guessesResult.gamesFound)} />
                  <StatCell label="Notícias" value={String(guessesResult.newsAnalyzed)} />
                  <StatCell label="Tempo" value={formatMs(guessesResult.executionMs)} />
                </div>
                {guessesResult.guesses.length > 0 && (
                  <div className="space-y-2">
                    {guessesResult.guesses.map((g) => (
                      <div key={g.gameId} className="bg-white rounded-lg border border-green-200 p-2.5 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-dark">{g.country1} vs {g.country2}</span>
                          <span className="text-sm font-bold text-primary">{g.result1} × {g.result2}</span>
                        </div>
                        {g.analysis && (
                          <p className="text-[11px] text-dark leading-snug border-t border-green-100 pt-1.5">
                            💡 {g.analysis}
                          </p>
                        )}
                        {g.reasoning && (
                          <p className="text-[11px] text-mid-gray italic leading-snug">
                            🎯 {g.reasoning}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Card>

      {/* ── Lista de entradas ──────────────────────────────────────────────── */}
      {toggleError && (
        <div className="rounded-xl px-4 py-3 bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
          ❌ {toggleError}
        </div>
      )}

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

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg border border-green-200 p-2 text-center">
      <p className="text-sm font-bold text-dark">{value}</p>
      <p className="text-[10px] text-mid-gray">{label}</p>
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
          <Link href={`/daisy/${diary.id}`} className="text-xs text-primary font-semibold hover:underline">
            Ver
          </Link>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-xs text-mid-gray underline hover:text-dark"
          >
            {expanded ? 'Fechar' : 'Preview'}
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
          <p className="text-sm text-dark leading-relaxed whitespace-pre-wrap line-clamp-6">{diary.content}</p>
        </div>
      )}
    </Card>
  )
}
