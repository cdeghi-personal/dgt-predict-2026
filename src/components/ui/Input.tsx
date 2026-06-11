import { clsx } from 'clsx'
import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className, id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-xs font-medium text-mid-gray">
          {label}
        </label>
      )}
      <input
        {...props}
        id={inputId}
        className={clsx(
          'w-full px-3 py-2.5 rounded-xl border text-sm text-dark bg-white',
          'placeholder:text-light-gray focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
          'transition-colors',
          error ? 'border-red-400' : 'border-light-gray',
          className,
        )}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

interface ScoreInputProps {
  value: number | null
  onChange: (v: number | null) => void
  disabled?: boolean
}

export function ScoreInput({ value, onChange, disabled }: ScoreInputProps) {
  return (
    <input
      type="number"
      min={0}
      max={20}
      value={value ?? ''}
      placeholder="–"
      onChange={(e) => {
        const raw = e.target.value
        if (raw === '') { onChange(null); return }
        const n = parseInt(raw, 10)
        if (!isNaN(n)) onChange(Math.max(0, Math.min(20, n)))
      }}
      disabled={disabled}
      className={clsx(
        'w-12 h-12 text-center text-xl font-bold rounded-xl border-2',
        'focus:outline-none focus:ring-2 focus:ring-primary',
        'placeholder:text-light-gray',
        disabled
          ? 'bg-gray-50 border-light-gray text-mid-gray cursor-not-allowed'
          : value === null
            ? 'bg-white border-primary/50 text-dark'
            : 'bg-white border-light-gray text-dark',
      )}
    />
  )
}
