'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  const [loginStr, setLoginStr] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/dashboard')
    }
  }, [isAuthenticated, isLoading, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(loginStr, password)
      router.replace('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer login.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-dark flex items-center justify-center px-4">
      {/* Background decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-secondary/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-dgt.png"
            alt="DGT"
            className="h-14 w-auto object-contain"
          />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">DGT Predict</h1>
            <p className="text-primary font-semibold">Copa do Mundo 2026</p>
          </div>
          <p className="text-white/50 text-sm text-center">
            Entre com sua conta DGT do SYDLE
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-surface rounded-2xl p-6 shadow-2xl space-y-4">
          <Input
            label="Login"
            type="text"
            value={loginStr}
            onChange={(e) => setLoginStr(e.target.value)}
            placeholder="seu.login@dgt.com"
            required
            autoComplete="username"
          />

          <Input
            label="Senha"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-xs text-red-700 text-center">{error}</p>
            </div>
          )}

          <Button type="submit" variant="primary" fullWidth loading={submitting} size="lg">
            Entrar
          </Button>
        </form>

        <p className="text-center text-white/30 text-xs mt-6">
          DGT Transformação Digital · Powered by IA
        </p>
      </div>
    </div>
  )
}
