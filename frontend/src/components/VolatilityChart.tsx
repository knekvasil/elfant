import type { PlayerCareerSeason } from '../types'

interface Props {
  season: PlayerCareerSeason
}

export default function VolatilityChart({ season }: Props) {
  const { floor, ceiling, avg_points: avg, std_dev, bust_rate } = season
  const scores = season.weeks.map((w) => w.fantasy_points)

  // Build distribution buckets: 0-5, 5-10, 10-15, ...
  const bucketSize = 5
  const maxBucket = Math.max(ceiling + bucketSize, 40)
  const buckets: { label: string; min: number; count: number }[] = []
  for (let b = 0; b < maxBucket; b += bucketSize) {
    const count = scores.filter((p) => p >= b && p < b + bucketSize).length
    if (count > 0 || b < 40) {
      buckets.push({ label: `${b}-${b + bucketSize}`, min: b, count })
    }
  }

  const maxCount = Math.max(...buckets.map((b) => b.count), 1)
  const H = 120
  const W = 170
  const PAD = { left: 4, right: 4, top: 4, bottom: 20 }
  const plotW = W - PAD.left - PAD.right
  const barW = Math.max(8, Math.min(14, (plotW / buckets.length) - 2))
  const plotH = H - PAD.top - PAD.bottom

  const yScale = (v: number) => PAD.top + (1 - v / maxCount) * plotH

  const bucketColor = (bucketMin: number) => {
    if (bucketMin >= avg) return 'fill-emerald-500/60'
    if (bucketMin >= 10) return 'fill-amber-500/50'
    return 'fill-red-500/50'
  }

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Histogram */}
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="text-foreground">
        {/* Grid line at avg */}
        <line x1={PAD.left} y1={yScale(0)} x2={W - PAD.right} y2={yScale(0)} stroke="currentColor" strokeWidth={0.5} className="text-border/20" />

        {buckets.map((b, i) => {
          const x = PAD.left + i * (barW + 2)
          const y = yScale(b.count)
          return (
            <g key={b.label}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(yScale(0) - y, 0)}
                rx={1.5}
                className={bucketColor(b.min)}
              />
              {/* X label */}
              <text
                x={x + barW / 2}
                y={H - 4}
                textAnchor="middle"
                className="fill-muted-foreground/30 text-[6px] font-medium tabular-nums"
              >
                {b.min}
              </text>
            </g>
          )
        })}

        {/* Avg marker line */}
        <line x1={PAD.left} y1={yScale(0)} x2={PAD.left + plotW} y2={yScale(0)} stroke="currentColor" strokeWidth={0.5} className="text-border/20" />
      </svg>

      {/* Key stats row */}
      <div className="flex items-center justify-center gap-3 text-[9px] tabular-nums -mt-0.5">
        <span className="text-red-400 font-semibold">{floor.toFixed(1)}</span>
        <span className="text-muted-foreground/40">|</span>
        <span className="text-primary font-bold">{avg.toFixed(1)}</span>
        <span className="text-muted-foreground/40">|</span>
        <span className="text-emerald-400 font-semibold">{ceiling.toFixed(1)}</span>
        <span className="text-muted-foreground/40">·</span>
        <span className="text-muted-foreground/50">&sigma;{std_dev.toFixed(1)}</span>
        <span className="text-muted-foreground/40">·</span>
        <span className="text-amber-400/70">bust {bust_rate}%</span>
      </div>
    </div>
  )
}
