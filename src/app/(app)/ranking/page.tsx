'use client'

import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { RankingTable } from '@/components/features/RankingTable'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { useRanking } from '@/hooks/useRanking'
import { useAuth } from '@/contexts/AuthContext'

export default function RankingPage() {
  const { data: ranking, isLoading, refetch } = useRanking()
  const { user } = useAuth()

  const myEntry = ranking?.find((r) => r.userId === user?.id)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-dark">🏆 Ranking</h1>
          <p className="text-sm text-mid-gray">{ranking?.length ?? 0} participantes</p>
        </div>
        <button
          onClick={() => refetch()}
          className="text-xs text-primary font-medium hover:underline"
        >
          Atualizar
        </button>
      </div>

      {/* Minha posição */}
      {myEntry && (
        <div className="bg-primary/10 border border-primary/30 rounded-2xl p-4">
          <p className="text-xs text-mid-gray mb-1">Sua posição</p>
          <div className="flex items-center gap-4">
            <span className="text-3xl font-bold text-primary">#{myEntry.position}</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-dark">{myEntry.userName}</p>
              <p className="text-xs text-mid-gray">
                {myEntry.totalPoints} pts · {myEntry.exactScores} 🎯 · {myEntry.correctResults} ✅
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabela completa */}
      <Card noPad>
        <CardHeader className="p-4 pb-0">
          <CardTitle>Classificação Geral</CardTitle>
        </CardHeader>
        <div className="mt-3">
          {isLoading ? (
            <PageLoader />
          ) : (
            <RankingTable entries={ranking ?? []} />
          )}
        </div>
      </Card>

      {/* Legenda de critérios */}
      <Card className="p-3 bg-background border-light-gray">
        <p className="text-xs font-semibold text-mid-gray mb-2">Critérios de desempate</p>
        <ol className="text-xs text-mid-gray space-y-0.5 list-decimal list-inside">
          <li>Maior pontuação total</li>
          <li>Mais placares exatos (🎯)</li>
          <li>Mais resultados corretos (✅)</li>
          <li>Ordem alfabética</li>
        </ol>
      </Card>
    </div>
  )
}
