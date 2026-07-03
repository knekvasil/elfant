import { Skeleton } from './ui/skeleton'
import { fetchTeamStats } from '../lib/api'
import { useEffect, useState } from 'react'
import type { TeamStatsData, Roster } from '../types'
import { cn } from '../lib/utils'

interface Props {
  leagueId: string
  highlightedRosterIds?: Set<number>
  mode: 'standard' | 'median' | 'all_play' | 'efficiency'
  rosters: Roster[]
  compact?: boolean
}

const TEAM_COLORS = [
  '#38bdf8', '#f472b6', '#a78bfa', '#34d399', '#fbbf24',
  '#fb923c', '#f87171', '#2dd4bf', '#818cf8', '#c084fc',
  '#4ade80', '#fde68a',
]

export default function RangeBarChart({ leagueId, highlightedRosterIds, mode, rosters, compact }: Props) {
  const [data, setData] = useState<TeamStatsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchTeamStats(leagueId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [leagueId])

  if (loading) return <Skeleton className="h-48 w-full" />
  if (!data || data.rosters.length === 0) return <div className="text-sm text-muted-foreground text-center py-6">No data available.</div>

  const isEff = mode === 'efficiency'

  type Row = { roster_id: number; name: string; avg: number; std: number; color: string }
  const rows: Row[] = data.rosters.map((r, i) => {
    const roster = rosters.find(ro => ro.roster_id === r.roster_id)
    let avg: number, std: number
    if (isEff) {
      const effVals = r.weekly.map(w => w.efficiency)
      const n = effVals.length
      const m = effVals.reduce((s, v) => s + v, 0) / n || 0
      const v = effVals.reduce((s, v) => s + (v - m) ** 2, 0) / n || 0
      avg = m
      std = Math.sqrt(v)
    } else {
      avg = r.season_avg
      std = r.season_std
    }
    return { roster_id: r.roster_id, name: roster?.team_name || r.name, avg, std, color: TEAM_COLORS[i % TEAM_COLORS.length] }
  })

  const hasSelection = highlightedRosterIds !== undefined && highlightedRosterIds.size > 0
  const displayRows = hasSelection
    ? rows.filter(r => highlightedRosterIds?.has(r.roster_id)).sort((a, b) => b.avg - a.avg)
    : rows.sort((a, b) => b.avg - a.avg)

  const allMins = displayRows.map(r => r.avg - r.std)
  const allMaxs = displayRows.map(r => r.avg + r.std)
  const xMin = Math.min(...allMins, 0)
  const xMax = Math.max(...allMaxs)
  const xRange = xMax - xMin || 1

  const barH = compact ? 14 : 18
  const gap = compact ? 5 : 8
  const totalH = displayRows.length * (barH + gap) + 10
  const labelW = compact ? 24 : 30
  const leftW = compact ? 90 : 110
  const rightW = compact ? 240 : 300
  const W = leftW + rightW + labelW

  const maxNameLen = compact ? 12 : 18

  const xScale = (v: number) => leftW + ((v - xMin) / xRange) * rightW

  return (
    <div className="w-full overflow-x-auto flex justify-center">
      <svg width={W} height={totalH} className="text-foreground flex-shrink-0">
        <line x1={xScale(0)} y1={0} x2={xScale(0)} y2={totalH} stroke="currentColor" className="text-border/30" strokeWidth={0.5} strokeDasharray="3 2" />
        {displayRows.map((row, i) => {
          const y = i * (barH + gap) + 4
          const x1 = xScale(row.avg - row.std)
          const x2 = xScale(row.avg + row.std)
          const cx = xScale(row.avg)
          const hl = hasSelection && highlightedRosterIds?.has(row.roster_id)
          const dm = hasSelection && !hl
          return (
            <g key={row.roster_id} opacity={dm ? 0.3 : 1} className="transition-all duration-200">
              <text x={leftW - 4} y={y + barH / 2 + 3} textAnchor="end" className="fill-muted-foreground text-[9px] font-semibold">
                {row.name.length > maxNameLen ? row.name.slice(0, maxNameLen) + '…' : row.name}
              </text>
              <rect x={x1} y={y + barH / 2 - 1.5} width={Math.max(x2 - x1, 2)} height={3} rx={1.5} fill={row.color} opacity={0.4} />
              <circle cx={cx} cy={y + barH / 2} r={4} fill={row.color} stroke="currentColor" strokeWidth={1} className={cn('text-background', hl ? 'stroke-2' : '')} />
              <text x={Math.min(x2 + 4, W - labelW + 4)} y={y + barH / 2 + 3} className="fill-muted-foreground text-[8px] font-mono">
                {row.avg.toFixed(1)}{isEff ? '%' : ''}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
