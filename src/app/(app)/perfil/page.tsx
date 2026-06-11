'use client'

import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'
import { useRanking } from '@/hooks/useRanking'
import { useMyGuesses } from '@/hooks/useGuesses'
import { useMatches } from '@/hooks/useMatches'
import { useRouter } from 'next/navigation'

export default function PerfilPage() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const { data: ranking } = useRanking()
  const { data: myGuesses } = useMyGuesses()
  const { data: matches } = useMatches()

  const myEntry = ranking?.find((r) => r.userId === user?.id)
  const totalMatches = matches?.length ?? 0
  const guessedMatches = myGuesses?.length ?? 0

  function handleLogout() {
    logout()
    router.replace('/login')
  }

  return (
    <div className="space-y-4 max-w-sm mx-auto">
      <h1 className="text-xl font-bold text-dark">Perfil</h1>

      {/* Avatar + nome */}
      <Card className="flex flex-col items-center gap-3 py-6">
        <div className="w-20 h-20 rounded-full bg-dark flex items-center justify-center text-3xl font-bold text-white">
          {user?.name?.[0]?.toUpperCase() ?? '?'}
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-dark">{user?.name}</p>
          <p className="text-sm text-mid-gray">{user?.login}</p>
          {user?.isAdmin && (
            <span className="mt-1 inline-block px-2 py-0.5 bg-dark text-white text-xs rounded-full">
              Admin
            </span>
          )}
        </div>
      </Card>

      {/* Estatísticas */}
      <Card>
        <p className="text-xs font-semibold text-mid-gray uppercase tracking-wide mb-3">Estatísticas</p>
        <div className="space-y-2">
          <StatRow label="Posição no ranking" value={myEntry ? `#${myEntry.position}` : '–'} />
          <StatRow label="Pontos totais" value={String(myEntry?.totalPoints ?? 0)} />
          <StatRow label="Placares exatos" value={String(myEntry?.exactScores ?? 0)} />
          <StatRow label="Resultados corretos" value={String(myEntry?.correctResults ?? 0)} />
          <StatRow label="Palpites registrados" value={`${guessedMatches} / ${totalMatches}`} />
        </div>
      </Card>

      {/* Regras de pontuação */}
      <Card className="bg-background border-light-gray">
        <p className="text-xs font-semibold text-mid-gray uppercase tracking-wide mb-3">Regras de Pontuação</p>
        <div className="space-y-2">
          <RuleRow emoji="🎯" label="Placar exato" points={10} />
          <RuleRow emoji="✅" label="Resultado correto (V/E/D)" points={5} />
          <RuleRow emoji="❌" label="Resultado errado" points={0} />
        </div>
        <p className="text-xs text-mid-gray mt-3">
          Prazo para palpitar: até o dia anterior ao jogo (23:59).
        </p>
      </Card>

      <Button variant="outline" fullWidth onClick={handleLogout} size="lg">
        Sair da conta
      </Button>

      <p className="text-center text-xs text-mid-gray pb-2">DGT Predict 2026 · Copa do Mundo FIFA</p>
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-light-gray last:border-b-0">
      <span className="text-sm text-mid-gray">{label}</span>
      <span className="text-sm font-bold text-dark">{value}</span>
    </div>
  )
}

function RuleRow({ emoji, label, points }: { emoji: string; label: string; points: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-dark">{emoji} {label}</span>
      <span className="text-sm font-bold text-dark">{points} pts</span>
    </div>
  )
}
