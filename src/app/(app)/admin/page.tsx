'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

const ADMIN_SECTIONS = [
  {
    href: '/admin/resultados',
    emoji: '📋',
    label: 'Resultados',
    description: 'Registrar e corrigir placares dos jogos',
  },
  {
    href: '/admin/daisy',
    emoji: '🤖',
    label: 'Daisy IA',
    description: 'Gerar diário, palpites e testar a IA',
  },
  {
    href: '/admin/auditoria',
    emoji: '📊',
    label: 'Auditoria',
    description: 'Histórico de alterações de resultados',
  },
]

export default function AdminHubPage() {
  const { user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user && !user.isAdmin) router.replace('/dashboard')
  }, [user, router])

  if (!user?.isAdmin) return null

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-dark">Administração</h1>
        <p className="text-sm text-mid-gray">Painel de gestão do bolão</p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {ADMIN_SECTIONS.map(({ href, emoji, label, description }) => (
          <Link key={href} href={href}>
            <div className="flex items-center gap-4 bg-white rounded-2xl border border-light-gray p-4 hover:border-dark hover:shadow-sm transition-all active:scale-[0.98]">
              <div className="w-12 h-12 rounded-xl bg-dark/5 flex items-center justify-center text-2xl shrink-0">
                {emoji}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-dark">{label}</p>
                <p className="text-sm text-mid-gray mt-0.5">{description}</p>
              </div>
              <span className="text-mid-gray text-sm shrink-0">→</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
