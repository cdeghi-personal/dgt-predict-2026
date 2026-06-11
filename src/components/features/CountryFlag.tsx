import { clsx } from 'clsx'

interface CountryFlagProps {
  flag: string
  name: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showName?: boolean
  namePosition?: 'below' | 'right'
  className?: string
}

const FLAG_SIZES = {
  sm: 'text-2xl',
  md: 'text-3xl',
  lg: 'text-4xl',
  xl: 'text-5xl',
}

const NAME_SIZES = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
  xl: 'text-lg',
}

export function CountryFlag({ flag, name, size = 'md', showName = false, namePosition = 'below', className }: CountryFlagProps) {
  const isFlagEmoji = /\p{Emoji_Presentation}/u.test(flag)
  const isIsoCode = /^[a-zA-Z]{2}(-[a-zA-Z]{3})?$/.test(flag)

  return (
    <div
      className={clsx(
        'flex items-center',
        namePosition === 'below' ? 'flex-col gap-1' : 'gap-2',
        className,
      )}
    >
      {isFlagEmoji ? (
        <span className={clsx(FLAG_SIZES[size], 'leading-none')}>{flag}</span>
      ) : isIsoCode ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://flagcdn.com/48x36/${flag.toLowerCase()}.png`}
          alt={name}
          className={clsx(
            'object-contain',
            { 'w-6 h-4': size === 'sm', 'w-8 h-6': size === 'md', 'w-10 h-7': size === 'lg', 'w-14 h-10': size === 'xl' },
          )}
        />
      ) : (
        <span className={clsx(FLAG_SIZES[size], 'leading-none')}>🏳️</span>
      )}

      {showName && (
        <span className={clsx(NAME_SIZES[size], 'font-medium text-dark text-center leading-tight')}>
          {name}
        </span>
      )}
    </div>
  )
}
