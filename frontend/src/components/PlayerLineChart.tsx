import type { PlayerCareerSeason } from '../types'

interface Props {
  seasons: PlayerCareerSeason[]
  focusedSeason?: number | null
}

const SEASON_COLORS = ['#38bdf8', '#f472b6', '#a78bfa', '#34d399', '#fbbf24', '#fb923c', '#f87171', '#2dd4bf']

export default function PlayerLineChart({ seasons, focusedSeason }: Props) {
  if (seasons.length === 0) return null

  const displaySeasons = focusedSeason
    ? seasons.filter((s) => s.season === focusedSeason)
    : seasons

  const allWeeks = displaySeasons.flatMap((s) => s.weeks)
  if (allWeeks.length === 0) return null

  const maxPts = Math.max(...allWeeks.map((w) => w.fantasy_points))
  const ceiling = Math.ceil(Math.max(maxPts, 60) / 5) * 5

  const W = 600
  const H = 200
  const PAD = { top: 8, right: 12, bottom: 24, left: 28 }
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom

  const xScale = (week: number, total: number) => PAD.left + ((week - 1) / Math.max(total - 1, 1)) * plotW
  const yScale = (v: number) => PAD.top + (1 - v / ceiling) * plotH

  const yTicks = []
  for (let v = 0; v <= ceiling; v += Math.max(1, Math.round(ceiling / 4))) {
    yTicks.push(v)
  }
  if (yTicks[yTicks.length - 1] !== ceiling) yTicks.push(ceiling)

  return (
    <div>
      <svg width="100%" height="auto" className="text-foreground w-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} y1={yScale(v)} x2={W - PAD.right} y2={yScale(v)} stroke="currentColor" className="text-border/20" strokeWidth={1} />
            <text x={PAD.left - 4} y={yScale(v) + 3} textAnchor="end" className="fill-muted-foreground/40 text-[8px] font-medium">{v}</text>
          </g>
        ))}

        {displaySeasons.map((season, si) => {
          const total = season.weeks.length
          if (total === 0) return null
          const pts = season.weeks.map((w) => w.fantasy_points)
          const avg = season.avg_points
          const color = SEASON_COLORS[si % SEASON_COLORS.length]
          const isFaded = focusedSeason != null && season.season !== focusedSeason

          const points = pts.map((p, i) => `${xScale(i + 1, total)},${yScale(p)}`).join(' ')
          const avgY = yScale(avg)

          return (
            <g key={season.season} opacity={isFaded ? 0.15 : 1}>
              <line x1={PAD.left} y1={avgY} x2={PAD.left + plotW} y2={avgY} stroke={color} strokeWidth={1} strokeDasharray="4 3" opacity={0.35} />
              <polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" opacity={0.85} />
              {pts.map((p, i) => (
                <circle key={i} cx={xScale(i + 1, total)} cy={yScale(p)} r={2.5} fill={color} opacity={0.85} />
              ))}
            </g>
          )
        })}

        {[1, 5, 9, 13, 17].filter((w) => w <= Math.max(...allWeeks.map((x) => x.week))).map((w) => (
          <text key={w} x={xScale(w, 18)} y={H - 4} textAnchor="middle" className="fill-muted-foreground/40 text-[8px] font-medium">W{w}</text>
        ))}
      </svg>

      {/* Bottom legend */}
      {displaySeasons.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
          {displaySeasons.map((s, si) => (
            <div key={s.season} className="flex items-center gap-1">
              <div className="size-2 rounded-full" style={{ backgroundColor: SEASON_COLORS[si % SEASON_COLORS.length] }} />
              <span className="text-[9px] font-medium text-muted-foreground/60">
                &apos;{String(s.season).slice(2)}
                <span className="ml-1 font-semibold text-foreground/70">{s.avg_points.toFixed(1)}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
