import { cn } from '../lib/utils'

interface Props {
  label: string
  value: number
  max: number
  unit?: string
  size?: 'sm' | 'md' | 'lg'
}

function segmentColor(ratio: number): string {
  if (ratio > 0.7) return 'stroke-emerald-400'
  if (ratio > 0.4) return 'stroke-amber-400'
  return 'stroke-red-400'
}

function bgColor(ratio: number): string {
  if (ratio > 0.7) return 'text-emerald-300'
  if (ratio > 0.4) return 'text-amber-300'
  return 'text-red-300'
}

export default function UsagePie({ label, value, max, unit = '', size = 'md' }: Props) {
  const ratio = max > 0 ? Math.min(value / max, 1) : 0
  const pct = Math.round(ratio * 100)
  const r = size === 'lg' ? 30 : size === 'md' ? 22 : 18
  const sw = size === 'lg' ? 5 : 4
  const dim = (r + 6) * 2
  const circumference = 2 * Math.PI * r
  const dash = ratio * circumference

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="relative" style={{ width: dim, height: dim }}>
        <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`} className="-rotate-90">
          <circle cx={dim / 2} cy={dim / 2} r={r} fill="none" stroke="currentColor" strokeWidth={sw} className="text-muted/20" />
          <circle
            cx={dim / 2}
            cy={dim / 2}
            r={r}
            fill="none"
            strokeWidth={sw}
            strokeLinecap="round"
            className={segmentColor(ratio)}
            strokeDasharray={`${dash} ${circumference - dash}`}
            style={{ transition: 'stroke-dasharray 0.3s ease' }}
          />
        </svg>
        <span className={cn('absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums', bgColor(ratio))}>
          {pct}
        </span>
      </div>
      <span className={cn('font-medium text-muted-foreground/60', size === 'sm' ? 'text-[8px]' : 'text-[10px]')}>{label}</span>
      <span className={cn('font-semibold tabular-nums text-muted-foreground/80', size === 'sm' ? 'text-[9px]' : 'text-xs')}>
        {value}{unit}
      </span>
    </div>
  )
}
