import { cn } from '../lib/utils'
import type { PlayerCareerSeason } from '../types'

interface Props {
  seasons: PlayerCareerSeason[]
  onHoverSeason?: (season: number | null) => void
}

function cellColor(points: number, min: number, max: number): string {
  if (max === min) return 'bg-yellow-500/30'
  const ratio = (points - min) / (max - min)
  if (ratio > 0.7) return 'bg-emerald-500/50'
  if (ratio > 0.4) return 'bg-yellow-500/35'
  return 'bg-red-500/35'
}

export default function PlayerHeatGrid({ seasons, onHoverSeason }: Props) {
  if (seasons.length === 0) return null

  const sorted = [...seasons].sort((a, b) => b.season - a.season)
  const allPoints = seasons.flatMap((s) => s.weeks.map((w) => w.fantasy_points))
  const min = Math.min(...allPoints)
  const max = Math.max(...allPoints)

  const weekNumbers = [...new Set(seasons.flatMap((s) => s.weeks.map((w) => w.week)))].sort((a, b) => a - b)

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse">
        <thead>
          <tr>
            <th className="text-left text-[8px] text-muted-foreground/40 font-medium pr-1 pb-1" style={{ width: 16 }}>Wk</th>
            {sorted.map((s) => (
              <th
                key={s.season}
                className="text-center text-[8px] text-muted-foreground/40 font-medium pb-1 cursor-pointer hover:text-foreground/60 transition-colors"
                style={{ width: 18, minWidth: 18 }}
                onMouseEnter={() => onHoverSeason?.(s.season)}
                onMouseLeave={() => onHoverSeason?.(null)}
              >
                &apos;{String(s.season).slice(2)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weekNumbers.map((wk) => {
            const hasData = sorted.some((s) => s.weeks.some((w) => w.week === wk))
            if (!hasData) return null

            return (
              <tr key={wk}>
                <td className="text-[8px] text-muted-foreground/40 font-medium pr-1 py-px align-middle" style={{ width: 16 }}>
                  W{wk}
                </td>
                {sorted.map((s) => {
                  const week = s.weeks.find((w) => w.week === wk)
                  const isPost = week?.season_type === 'POST'

                  if (!week) {
                    return (
                      <td key={s.season} className="py-px">
                        <div className="size-4 rounded-sm bg-muted/10" />
                      </td>
                    )
                  }

                  return (
                    <td
                      key={s.season}
                      className="py-px"
                      title={`${s.season} W${wk}${isPost ? ' (POST)' : ''}: ${week.fantasy_points.toFixed(1)} pts vs ${week.opponent}`}
                    >
                      <div
                        className={cn(
                          'size-4 rounded-sm flex items-center justify-center text-[6px] font-bold leading-none',
                          cellColor(week.fantasy_points, min, max),
                          isPost ? 'ring-1 ring-amber-400/50' : '',
                        )}
                      >
                        {week.fantasy_points.toFixed(0)}
                      </div>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="flex items-center gap-1 mt-2">
        <span className="text-[7px] text-red-400/60">low</span>
        <div className="flex gap-px">
          <div className="size-2 rounded-sm bg-red-500/35" />
          <div className="size-2 rounded-sm bg-yellow-500/35" />
          <div className="size-2 rounded-sm bg-emerald-500/50" />
        </div>
        <span className="text-[7px] text-emerald-400/60">high</span>
        <span className="text-[7px] text-amber-400/60 ml-1.5">⋆ playoff</span>
      </div>
    </div>
  )
}
