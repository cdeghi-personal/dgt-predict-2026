import { format, parseISO, isToday, isTomorrow, isYesterday, isPast } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function formatMatchDate(dateStr: string): string {
  const d = parseISO(dateStr)
  if (isToday(d)) return 'Hoje'
  if (isTomorrow(d)) return 'Amanhã'
  if (isYesterday(d)) return 'Ontem'
  return format(d, "dd 'de' MMMM", { locale: ptBR })
}

export function formatFullDate(dateStr: string): string {
  return format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR })
}

export function formatDateTime(dateStr: string, time: string): string {
  return `${formatMatchDate(dateStr)} às ${time}`
}

/**
 * Retorna true se o prazo de palpite expirou.
 * Fecha exatamente no horário de início do jogo (matchTime = "HH:MM" UTC).
 * Se matchTime não for informado, fecha no início do dia (meia-noite UTC).
 */
export function isGuessingClosed(matchDate: string, matchTime?: string): boolean {
  if (!matchDate) return true
  const iso = matchTime && matchTime !== '00:00'
    ? `${matchDate}T${matchTime}:00Z`
    : `${matchDate}T00:00:00Z`
  return new Date() >= new Date(iso)
}

export function isoToday(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function isoTomorrow(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return format(d, 'yyyy-MM-dd')
}

// Rótulos legíveis para as fases — chaves correspondem aos valores do SYDLE (campo phase)
export const PHASE_LABELS: Record<string, string> = {
  grupos: 'Fase de Grupos',
  oitavas: 'Oitavas de Final',
  quartas: 'Quartas de Final',
  semifinais: 'Semifinal',
  finais: 'Final',
}
