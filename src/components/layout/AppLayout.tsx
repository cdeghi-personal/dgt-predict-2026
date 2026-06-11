'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { PageLoader } from '@/components/ui/LoadingSpinner'

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login')
    }
  }, [isAuthenticated, isLoading, router])

  if (isLoading) return <PageLoader />
  if (!isAuthenticated) return null

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      {/* main — empurra conteúdo à direita da sidebar no desktop */}
      <main className="md:pl-60 pb-20 md:pb-0 min-h-screen">
        <div className="max-w-5xl mx-auto px-4 py-6">{children}</div>
      </main>
      <BottomNav />
    </div>
  )
}
