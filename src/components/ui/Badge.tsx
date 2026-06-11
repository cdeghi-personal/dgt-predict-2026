import { clsx } from 'clsx'
import type { HTMLAttributes } from 'react'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  color?: 'gray' | 'green' | 'amber' | 'red' | 'blue' | 'dark'
}

export function Badge({ color = 'gray', className, children, ...props }: BadgeProps) {
  return (
    <span
      {...props}
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        {
          'bg-gray-100 text-gray-700': color === 'gray',
          'bg-green-100 text-green-700': color === 'green',
          'bg-amber-100 text-amber-700': color === 'amber',
          'bg-red-100 text-red-700': color === 'red',
          'bg-blue-100 text-blue-700': color === 'blue',
          'bg-dark text-white': color === 'dark',
        },
        className,
      )}
    >
      {children}
    </span>
  )
}
