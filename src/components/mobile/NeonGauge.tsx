import { useEffect, useId, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * surface = 'dark'  → gauge sits on an always-dark surface (hero banners):
 *                     white value, slate label.
 * surface = 'auto'  → gauge sits on a theme-aware card: value and labels
 *                     follow --foreground/--muted so BOTH light and dark
 *                     mode stay readable (fixes the original bug where the
 *                     value was white on the white light-mode card).
 */
export default function NeonGauge({
  value,
  label,
  caption,
  size = 244,
  className,
  surface = 'auto',
}: {
  value: number
  label?: string
  caption?: string
  size?: number
  className?: string
  surface?: 'dark' | 'auto'
}) {
  const gradientId = useId().replace(/:/g, '')
  const [animatedValue, setAnimatedValue] = useState(0)
  const safeValue = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))

  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnimatedValue(safeValue))
    return () => cancelAnimationFrame(frame)
  }, [safeValue])

  const onDark = surface === 'dark'

  return (
    <div
      className={cn('neon-gauge relative mx-auto', className)}
      style={{ width: size, maxWidth: '100%', aspectRatio: '1.18 / 1' }}
      role="img"
      aria-label={`${label || 'Score'} ${safeValue.toFixed(1)} percent`}
    >
      <svg viewBox="0 0 220 188" className="absolute inset-0 h-full w-full overflow-visible">
        <defs>
          <linearGradient id={gradientId} x1="22" y1="100" x2="198" y2="100" gradientUnits="userSpaceOnUse">
            <stop stopColor="#21E6C1" />
            <stop offset="0.5" stopColor="#24C8FF" />
            <stop offset="1" stopColor="#9B5CFF" />
          </linearGradient>
          <filter id={`${gradientId}-glow`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <path
          d="M 28 120 A 82 82 0 0 1 192 120"
          pathLength="100"
          fill="none"
          stroke={onDark ? 'rgba(148,163,184,.12)' : 'hsl(var(--muted))'}
          strokeWidth="15"
          strokeLinecap="round"
        />
        <path
          d="M 28 120 A 82 82 0 0 1 192 120"
          pathLength="100"
          fill="none"
          stroke={onDark ? 'rgba(148,163,184,.16)' : 'hsl(var(--muted-foreground) / .28)'}
          strokeWidth="2"
          strokeLinecap="round"
          transform="translate(0 -18)"
        />
        <path
          d="M 28 120 A 82 82 0 0 1 192 120"
          pathLength="100"
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray="100"
          strokeDashoffset={100 - animatedValue}
          filter={`url(#${gradientId}-glow)`}
          style={{ transition: 'stroke-dashoffset 1.35s cubic-bezier(.16,1,.3,1)' }}
        />
        <circle cx="28" cy="120" r="3" fill="#21E6C1" opacity=".9" />
        <circle cx="192" cy="120" r="3" fill="#9B5CFF" opacity=".9" />
      </svg>
      <div className="absolute inset-x-0 top-[43%] -translate-y-1/2 text-center">
        <div className={cn(
          'gauge-value text-[42px] font-black tracking-[-0.055em] leading-none',
          onDark ? 'text-white' : 'text-foreground'
        )}>
          {safeValue.toFixed(1)}
          <span className={cn('text-[24px]', onDark ? 'text-white/90' : 'text-muted-foreground')}>%</span>
        </div>
        {label && (
          <div className={cn('mt-2 text-[12px] font-medium', onDark ? 'text-slate-400' : 'text-muted-foreground')}>
            {label}
          </div>
        )}
      </div>
      {caption && (
        <div className={cn(
          'absolute inset-x-0 bottom-1 text-center text-[10px] font-semibold uppercase tracking-[0.16em]',
          onDark ? 'text-cyan-300/80' : 'text-indigo-500/80 dark:text-cyan-300/80'
        )}>
          {caption}
        </div>
      )}
    </div>
  )
}
