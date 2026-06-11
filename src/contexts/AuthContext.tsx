'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { AuthUser } from '@/lib/types'

const SESSION_KEY = 'dgt_predict_session'

interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (loginStr: string, password: string) => Promise<void>
  logout: () => void
  authHeader: () => Record<string, string>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Restaura sessão ao montar (equivalente ao sessionRetomada do Flutter)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      if (raw) {
        const stored: AuthUser = JSON.parse(raw)
        // Valida expiração
        if (stored.tokenExp * 1000 > Date.now()) {
          setUser(stored)
        } else {
          localStorage.removeItem(SESSION_KEY)
        }
      }
    } catch {
      localStorage.removeItem(SESSION_KEY)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const login = useCallback(async (loginStr: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: loginStr, password }),
    })

    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error ?? 'Erro ao fazer login.')
    }

    const userData: AuthUser = await res.json()
    localStorage.setItem(SESSION_KEY, JSON.stringify(userData))
    setUser(userData)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY)
    setUser(null)
  }, [])

  // Headers padrão para chamadas às API routes
  const authHeader = useCallback((): Record<string, string> => {
    if (!user) return {}
    return {
      Authorization: `Bearer ${user.token}`,
      'X-User-Login': user.login,
      'Content-Type': 'application/json',
    }
  }, [user])

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout, authHeader }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
