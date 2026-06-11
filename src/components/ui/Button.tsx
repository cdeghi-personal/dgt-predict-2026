import { clsx } from 'clsx'
import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  fullWidth?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  fullWidth,
  children,
  disabled,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all',
        'focus:outline-none focus:ring-2 focus:ring-offset-2',
        {
          'bg-primary text-dark hover:bg-amber-400 focus:ring-primary disabled:opacity-50':
            variant === 'primary',
          'bg-secondary text-dark hover:bg-yellow-300 focus:ring-secondary disabled:opacity-50':
            variant === 'secondary',
          'border-2 border-dark text-dark hover:bg-dark hover:text-white focus:ring-dark disabled:opacity-50':
            variant === 'outline',
          'text-mid-gray hover:bg-gray-100 focus:ring-gray-300 disabled:opacity-50':
            variant === 'ghost',
          'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500 disabled:opacity-50':
            variant === 'danger',
        },
        {
          'text-xs px-3 py-1.5': size === 'sm',
          'text-sm px-4 py-2.5': size === 'md',
          'text-base px-6 py-3': size === 'lg',
        },
        fullWidth && 'w-full',
        className,
      )}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      )}
      {children}
    </button>
  )
}
