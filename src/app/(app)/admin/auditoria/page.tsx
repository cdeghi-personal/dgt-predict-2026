'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { useAuth } from '@/contexts/AuthContext'
import { useQuery } from '@tanstack/react-query'
import type { Match } from '@/lib/types'

interface AuditRecord {
  matchId: string
  matchLabel: string
  oldScore: string
  newScore: string
  changedBy: string
  changedAt: string
}

export default function AuditoriaPage() {
  const { user, authHeader } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!user?.isAdmin) router.replace('/dashboard')
  }, [user, router])

  // Busca histórico de alterações via SYDLE _getHistory
  const { data: matches, isLoading } = useQuery<Match[]>({
    queryKey: ['audit-matches'],
    queryFn: async () => {
      const res = await fetch('/api/admin/results', { headers: authHeader() })
      if (!res.ok) throw new Error('Erro.')
      return res.json()
    },
    enabled: !!user?.isAdmin,
  })

  if (!user?.isAdmin) return null
  if (isLoading) return <PageLoader />

  // Para auditoria real, precisaríamos do método _getHistory do SYDLE.
  // Por ora, exibimos a lista de partidas finalizadas como registro.
  const finished = matches?.filter((m) => m.status === 'FINISHED') ?? []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-dark">Auditoria</h1>
        <p className="text-sm text-mid-gray">Histórico de resultados registrados</p>
      </div>

      <Card className="p-3 bg-amber-50 border-amber-200">
        <p className="text-xs text-amber-800">
          <strong>Nota:</strong> Para auditoria completa com histórico de alterações, configure o método <code>_getHistory</code> do SYDLE ONE na rota <code>/api/admin/auditoria</code>.
        </p>
      </Card>

      {finished.length === 0 ? (
        <div className="text-center py-16 text-mid-gray">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-medium">Nenhum resultado registrado ainda.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {finished.map((match) => (
            <Card key={match.id} className="p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-dark truncate">
                    {match.country1.name} {match.scoreCountry1} × {match.scoreCountry2} {match.country2.name}
                  </p>
                  <p className="text-xs text-mid-gray">
                    {match.matchDate} · {match.matchTime}
                  </p>
                </div>
                <Badge color="green">Finalizado</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
