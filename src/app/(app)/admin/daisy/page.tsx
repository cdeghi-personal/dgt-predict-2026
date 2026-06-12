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
import type { DaisyAITestResult, GenerateDiaryResult, GenerateGuessesResult, DiaryDebugInfo } from '@/lib/daisy/types'

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
      if (data.saved) {
        qc.invalidateQueries({ queryKey: ['admin-daisy-diaries'] })
        qc.invalidateQueries({ queryKey: ['daisy-diaries'] })
      }
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

  // ── Exclusão de entrada inativa ────────────────────────────────────────────
  const deleteDiary = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch('/api/admin/daisy', {
        method: 'DELETE',
        headers: authHeader(),
        body: JSON.stringify({ id }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(d.error ?? `Erro ao excluir (${res.status}).`)
      }
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['admin-daisy-diaries'] })
      const prev = qc.getQueryData<DaisyDiary[]>(['admin-daisy-diaries'])
      qc.setQueryData<DaisyDiary[]>(['admin-daisy-diaries'], (old) =>
        old?.filter((d) => d.id !== id) ?? []
      )
      return { prev }
    },
    onError: (_err, _id, context) => {
      if (context?.prev) qc.setQueryData(['admin-daisy-diaries'], context.prev)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-daisy-diaries'] })
      qc.invalidateQueries({ queryKey: ['daisy-diaries'] })
    },
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
          <GenerateResultPanel result={generateResult} formatDate={formatDate} formatMs={formatMs} />
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
                onDelete={(id) => deleteDiary.mutate(id)}
                deleting={deleteDiary.isPending}
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

// ─── Painel de resultado + debug da geração ──────────────────────────────────

function GenerateResultPanel({
  result,
  formatDate,
  formatMs,
}: {
  result: GenerateDiaryResult
  formatDate: (iso: string) => string
  formatMs: (ms: number) => string
}) {
  const [showDebug, setShowDebug] = useState(false)

  const borderColor = result.saved ? 'border-green-200' : 'border-amber-300'
  const bgColor     = result.saved ? 'bg-green-50'       : 'bg-amber-50'

  return (
    <div className={`rounded-xl p-3 border ${bgColor} ${borderColor} space-y-3`}>
      {result.saved ? (
        <p className="font-bold text-green-700 text-sm">✅ Diário gerado com sucesso!</p>
      ) : (
        <p className="font-bold text-amber-700 text-sm">⚠️ Diário NÃO salvo — {result.validationError}</p>
      )}

      {/* Dados do diário (só quando salvo) */}
      {result.saved && result.diary && (
        <div className="text-xs text-dark space-y-0.5">
          <p><span className="font-semibold text-mid-gray">Título:</span> {result.diary.title}</p>
          {result.diary.subtitle && (
            <p><span className="font-semibold text-mid-gray">Subtítulo:</span> {result.diary.subtitle}</p>
          )}
          <p><span className="font-semibold text-mid-gray">Data:</span> {formatDate(result.diary.createdAt)}</p>
        </div>
      )}

      {/* Resumo de contexto */}
      <div className="rounded-lg bg-white border border-gray-200 p-2 text-xs font-mono text-mid-gray space-y-0.5">
        <p className="font-semibold text-dark text-[10px] uppercase tracking-wide mb-1">Contexto enviado à IA</p>
        <p>
          Resultados recentes:{' '}
          <span className={result.recentResultsCount > 0 ? 'text-green-700 font-bold' : 'text-red-500 font-bold'}>
            {result.recentResultsCount}
          </span>
          {result.hasRecentResults ? ' ✅' : ' ❌'}
        </p>
        <p>Jogos futuros: <span className="text-dark font-semibold">{result.upcomingGamesCount}</span></p>
        <p>Notícias: <span className="text-dark font-semibold">{result.newsHighlightsCount}</span></p>
        <p>Execução: <span className="text-dark font-semibold">{formatMs(result.executionMs)}</span></p>
        <p className={result.debug.validationPassed ? 'text-green-700' : 'text-red-600 font-semibold'}>
          Validação: {result.debug.validationNote}
        </p>
      </div>

      {/* Ver diário (só quando salvo) */}
      {result.saved && result.diary && (
        <Link href={`/daisy/${result.diary.id}`}>
          <Button variant="secondary" fullWidth>Visualizar Diário →</Button>
        </Link>
      )}

      {/* Toggle debug */}
      <button
        onClick={() => setShowDebug((v) => !v)}
        className="w-full text-left text-xs font-mono text-mid-gray hover:text-dark border border-dashed border-gray-300 rounded-lg px-3 py-2"
      >
        {showDebug ? '▲ Fechar debug da geração' : '▼ Ver debug da geração'}
      </button>

      {showDebug && <DebugPanel debug={result.debug} />}
    </div>
  )
}

// ─── Debug Panel ──────────────────────────────────────────────────────────────

function DebugSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 text-xs font-semibold text-dark hover:bg-gray-100"
      >
        <span>{title}</span>
        <span className="text-mid-gray text-[10px]">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="p-3 bg-white">{children}</div>}
    </div>
  )
}

function JsonBlock({ data, label }: { data: unknown; label?: string }) {
  const [copied, setCopied] = useState(false)
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <div className="relative">
      {label && <p className="text-[10px] font-semibold text-mid-gray uppercase tracking-wide mb-1">{label}</p>}
      <button
        onClick={copy}
        className="absolute top-1 right-1 text-[9px] bg-gray-700 text-gray-200 hover:bg-gray-600 px-1.5 py-0.5 rounded z-10"
      >
        {copied ? '✓ copiado' : 'copiar'}
      </button>
      <pre className="text-[10px] font-mono overflow-auto max-h-72 bg-gray-950 text-green-300 rounded-lg p-3 pr-16 leading-relaxed whitespace-pre-wrap break-all">
        {text}
      </pre>
    </div>
  )
}

function DebugPanel({ debug }: { debug: DiaryDebugInfo }) {
  return (
    <div className="space-y-2">
      {/* 1. Resumo */}
      <DebugSection title="1. Resumo do contexto" defaultOpen>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono">
          <div><span className="text-mid-gray">Modelo:</span> {debug.model}</div>
          <div><span className="text-mid-gray">Gerado em:</span> {debug.generatedAt?.slice(0, 19)}Z</div>
          <div className={debug.recentResultEntries.length > 0 ? 'text-green-700 font-bold' : 'text-red-600 font-bold'}>
            Resultados recentes: {debug.recentResultEntries.length} {debug.recentResultEntries.length > 0 ? '✅' : '❌'}
          </div>
          <div><span className="text-mid-gray">Jogos futuros:</span> {debug.upcomingGamesDebug.length}</div>
          <div>
            <span className="text-mid-gray">Notícias (fontes):</span>{' '}
            <span className={debug.newsUrlResults.filter((u) => u.status === 'success').length > 0 ? 'text-green-700 font-bold' : 'text-red-600 font-bold'}>
              {debug.newsUrlResults.filter((u) => u.status === 'success').length}/{debug.newsUrlResults.length} OK
            </span>
            {' · '}
            <span className={debug.newsSummaryEmpty ? 'text-red-600 font-bold' : 'text-green-700'}>
              summary {debug.newsSummaryEmpty ? 'VAZIO ❌' : '✅'}
            </span>
          </div>
          <div><span className="text-mid-gray">Prompts carregados:</span> {debug.promptsLoadedCount}</div>
          <div><span className="text-mid-gray">Jogos analisados (raw):</span> {debug.gamesRawCount}</div>
          <div><span className="text-mid-gray">Resultados (raw):</span> {debug.resultsRawCount}</div>
          <div className="col-span-2 mt-1">
            <span className="text-mid-gray">Corte de tempo:</span>{' '}
            <span className="text-dark">{debug.cutoffLabel}</span>
          </div>
          {debug.lastDiaryDate && (
            <div className="col-span-2">
              <span className="text-mid-gray">Último diário:</span>{' '}
              <span className="text-dark">{debug.lastDiaryDate.slice(0, 19)}Z</span>
            </div>
          )}
          <div className={`col-span-2 mt-1 font-semibold ${debug.validationPassed ? 'text-green-700' : 'text-red-700'}`}>
            Validação: {debug.validationNote}
          </div>
        </div>
      </DebugSection>

      {/* 2. Resultados no SYDLE — visão resultado-primeiro (diagnóstico principal) */}
      <DebugSection title={`2. Resultados no SYDLE (${debug.resultsDebug.length}) — diagnóstico principal`}>
        <div className="space-y-0.5">
          {debug.resultsDebug.length === 0 && (
            <p className="text-xs text-red-600 font-medium">⚠️ Nenhum resultado registrado no SYDLE ainda.</p>
          )}
          {debug.resultsDebug.map((r, i) => (
            <div
              key={i}
              className={`text-[10px] font-mono flex flex-wrap gap-x-3 py-0.5 border-b border-gray-100 ${r.withinWindow ? 'bg-green-50' : ''}`}
            >
              <span className={`font-semibold ${r.withinWindow ? 'text-green-700' : r.gameFoundInMap && !r.isInFuture ? 'text-amber-600' : 'text-mid-gray'}`}>
                {r.country1} {r.score} {r.country2}
              </span>
              <span className={r.gameFoundInMap ? 'text-gray-500' : 'text-red-600 font-bold'}>
                {r.gameFoundInMap ? 'jogo ✓' : '⚠️ jogo não encontrado no gameMap'}
              </span>
              {r.gameFoundInMap && (
                <>
                  <span className={r.isInFuture ? 'text-blue-500' : 'text-gray-500'}>
                    {r.isInFuture ? '🔵 futuro' : '⚫ passado'}
                  </span>
                  <span className={r.withinWindow ? 'text-green-600 font-bold' : 'text-amber-500'}>
                    {r.withinWindow ? '✅ na janela' : '⚠️ fora da janela'}
                  </span>
                </>
              )}
              <span className="text-gray-400">{r.gameDateLabel}</span>
            </div>
          ))}
        </div>
      </DebugSection>

      {/* 3. Jogos analisados — visão jogo-primeiro (top 50 por data DESC) */}
      <DebugSection title={`3. Jogos analisados — top 50 por data (${debug.allGamesAnalyzed.length})`}>
        <div className="space-y-0.5">
          {debug.allGamesAnalyzed.length === 0 && (
            <p className="text-xs text-red-600 font-medium">⚠️ Nenhum jogo retornado pelo SYDLE.</p>
          )}
          {debug.allGamesAnalyzed.map((g, i) => (
            <div
              key={i}
              className={`text-[10px] font-mono flex flex-wrap gap-x-3 gap-y-0 border-b border-gray-100 py-0.5 ${
                g.withinWindow ? 'bg-green-50' : ''
              }`}
            >
              <span className={`font-semibold ${g.withinWindow ? 'text-green-700' : g.hasResult && !g.isInFuture ? 'text-amber-600' : 'text-mid-gray'}`}>
                {g.country1} vs {g.country2}
              </span>
              <span>{g.hasResult ? `✓ ${g.result1}×${g.result2}` : '✗ sem resultado'}</span>
              <span className={g.isInFuture ? 'text-blue-500' : 'text-gray-500'}>
                {g.isInFuture ? '🔵 futuro' : '⚫ passado'}
              </span>
              <span className={g.withinWindow ? 'text-green-600 font-bold' : g.hasResult && !g.isInFuture ? 'text-amber-500' : 'text-gray-400'}>
                {g.withinWindow ? '✅ na janela' : g.hasResult && !g.isInFuture ? '⚠️ fora da janela' : '—'}
              </span>
              <span className="text-gray-400">
                {g.gameDateMs ? new Date(g.gameDateMs).toISOString().slice(0, 16) : `⚠️ NaN (raw: ${String(g.gameDateRaw).slice(0, 20)})`}
              </span>
            </div>
          ))}
        </div>
      </DebugSection>

      {/* 4. Resultados recentes enviados à IA */}
      <DebugSection title={`4. Resultados recentes enviados à IA (${debug.recentResultEntries.length})`}>
        {debug.recentResultEntries.length === 0 ? (
          <p className="text-xs text-red-600 font-medium">⚠️ Nenhum resultado recente — verifique a seção 2 para entender o motivo.</p>
        ) : (
          <JsonBlock data={debug.recentResultEntries} />
        )}
      </DebugSection>

      {/* 5. Jogos futuros */}
      <DebugSection title={`5. Jogos futuros enviados à IA (${debug.upcomingGamesDebug.length})`}>
        {debug.upcomingGamesDebug.length === 0 ? (
          <p className="text-xs text-amber-600">Nenhum jogo futuro encontrado.</p>
        ) : (
          <JsonBlock data={debug.upcomingGamesDebug} />
        )}
      </DebugSection>

      {/* 6. Notícias — debug por URL + summary */}
      <DebugSection title={`6. Notícias (${debug.newsUrlResults.filter((u) => u.status === 'success').length}/${debug.newsUrlResults.length} fontes OK · summary ${debug.newsSummaryEmpty ? 'VAZIO ❌' : '✅'})`}>
        <div className="space-y-2">
          {debug.newsUrlResults.map((u, i) => (
            <div key={i} className={`rounded-lg border p-2 ${u.status === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-[10px] break-all text-dark">{u.url}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-[10px] font-bold ${u.status === 'success' ? 'text-green-700' : 'text-red-600'}`}>
                    {u.status === 'success' ? '✅' : '❌'}
                  </span>
                  <span className="text-[10px] text-mid-gray">{u.durationMs}ms</span>
                </div>
              </div>
              {u.errorMessage && (
                <p className="text-[10px] text-red-700 mt-1 font-mono">{u.errorMessage}</p>
              )}
              {u.contentPreview && (
                <p className="text-[10px] text-mid-gray mt-1 leading-relaxed line-clamp-2">{u.contentPreview}</p>
              )}
            </div>
          ))}
          {debug.newsUrlResults.length === 0 && (
            <p className="text-xs text-red-600 font-medium">⚠️ Nenhuma fonte de notícias configurada.</p>
          )}
        </div>
        <div className="mt-3">
          <p className="text-[10px] font-semibold text-mid-gray uppercase tracking-wide mb-1">
            Summary gerado pela IA {debug.newsSummaryEmpty ? '— VAZIO ❌' : '✅'}
          </p>
          {debug.newsSummaryEmpty ? (
            <p className="text-xs text-red-600 italic">
              Nenhum summary — ou todas as fontes falharam, ou o prompt DAISY_NEWS_SUMMARY está vazio/inativo.
            </p>
          ) : (
            <pre className="text-[10px] font-mono bg-gray-50 rounded-lg p-2 leading-relaxed whitespace-pre-wrap text-dark">
              {debug.newsSummaryPreview}…
            </pre>
          )}
        </div>
      </DebugSection>

      {/* 6. Prompts */}
      <DebugSection title={`6. Prompts carregados (${debug.promptsLoaded.length})`}>
        <div className="space-y-3">
          {debug.promptsLoaded.map((p, i) => (
            <div key={i} className="text-xs">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-mono font-bold text-dark">{p.identifier}</span>
                <span className="text-mid-gray text-[10px]">v{p.version}</span>
                <Badge color={p.active ? 'green' : 'gray'}>{p.active ? 'Ativo' : 'Inativo'}</Badge>
              </div>
              <p className="font-mono text-[10px] text-mid-gray bg-gray-50 rounded p-2 leading-relaxed">
                {p.preview}…
              </p>
            </div>
          ))}
          {debug.promptsLoaded.length === 0 && (
            <p className="text-xs text-red-600 font-medium">⚠️ Nenhum prompt carregado do SYDLE.</p>
          )}
        </div>
      </DebugSection>

      {/* 7. Payload final enviado à IA */}
      <DebugSection title="7. Payload final enviado à IA (user message)">
        <JsonBlock data={debug.finalPrompt} label="Prompt do usuário (system prompt separado)" />
      </DebugSection>

      {/* 8. Resposta bruta da IA */}
      <DebugSection title="8. Resposta bruta da IA (antes do parse)">
        <JsonBlock data={debug.rawAIResponse} />
      </DebugSection>

      {/* 9. Payload salvo no SYDLE */}
      <DebugSection title="9. Payload enviado ao _create de daisyDiary">
        {debug.savedPayload ? (
          <JsonBlock data={debug.savedPayload} />
        ) : (
          <p className="text-xs text-red-600 font-semibold">Diário não foi salvo (validação bloqueou).</p>
        )}
      </DebugSection>
    </div>
  )
}

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
  onDelete,
  deleting,
}: {
  diary: DaisyDiary
  onToggle: (active: boolean) => void
  toggling: boolean
  onDelete: (id: string) => void
  deleting: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

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
          {/* Excluir — só para entradas inativas */}
          {!diary.active && (
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={deleting}
              className="text-xs text-red-400 underline hover:text-red-600 disabled:opacity-50"
            >
              Excluir
            </button>
          )}
        </div>
      </div>

      {/* Confirmação de exclusão */}
      {confirmDelete && (
        <div className="mt-3 pt-3 border-t border-red-100 bg-red-50 rounded-xl px-3 py-2.5 flex items-center justify-between gap-3">
          <p className="text-xs text-red-700 font-medium">Excluir permanentemente esta entrada?</p>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs text-mid-gray underline hover:text-dark"
            >
              Cancelar
            </button>
            <button
              onClick={() => { onDelete(diary.id); setConfirmDelete(false) }}
              disabled={deleting}
              className="text-xs font-bold text-white bg-red-500 hover:bg-red-600 px-3 py-1 rounded-lg disabled:opacity-50 transition-colors"
            >
              {deleting ? 'Excluindo…' : 'Sim, excluir'}
            </button>
          </div>
        </div>
      )}

      {expanded && (
        <div className="mt-3 pt-3 border-t border-light-gray">
          <p className="text-sm text-dark leading-relaxed whitespace-pre-wrap line-clamp-6">{diary.content}</p>
        </div>
      )}
    </Card>
  )
}
