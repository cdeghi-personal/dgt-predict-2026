import { clsx } from 'clsx'
import type { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  highlight?: boolean
  noPad?: boolean
}

export function Card({ highlight, noPad, className, children, ...props }: CardProps) {
  return (
    <div
      {...props}
      className={clsx(
        'bg-surface rounded-2xl border',
        highlight ? 'border-primary border-2 shadow-md shadow-amber-100' : 'border-light-gray border',
        !noPad && 'p-4',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={clsx('flex items-center justify-between mb-3', className)}>
      {children}
    </div>
  )
}

export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 {...props} className={clsx('text-sm font-semibold text-dark uppercase tracking-wide', className)}>
      {children}
    </h3>
  )
}
