import { Skeleton } from './ui/skeleton'
import { fetchTeamStats } from '../lib/api'
import { useEffect, useState } from 'react'
import type { TeamStatsData } from '../types'

interface Props {
  leagueId: string
  highlightedRosterIds?: Set<number>
  compact?: boolean
}

const TEAM_COLORS = [
  '#38bdf8', '#f472b6', '#a78bfa', '#34d399', '#fbbf24',
  '#fb923c', '#f87171', '#2dd4bf', '#818cf8', '#c084fc',
  '#4ade80', '#fde68a',
]

export default function EfficiencyBarChart({ leagueId, highlightedRosterIds, compact }: Props) {
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

  const { weeks, rosters } = data
  const numWeeks = weeks.length
  const activeRosters = rosters.filter(r => highlightedRosterIds?.has(r.roster_id))
  const displayRosters = activeRosters.length > 0 ? activeRosters : rosters

  const hasEfficiencyData = rosters.some(r => r.weekly.some(w => w.efficiency !== 100))

  if (!hasEfficiencyData) {
    return <div className="text-sm text-muted-foreground text-center py-6">Lineup data not available for this league.</div>
  }

  const allEff = rosters.flatMap(r => r.weekly.map(w => w.efficiency))
  const minEff = Math.max(60, Math.min(...allEff) - 5)
  const maxEff = 100
  const effRange = maxEff - minEff

  const PAD = { top: 10, right: 12, bottom: 22, left: 34 }
  const W = compact ? 380 : 520
  const H = compact ? 150 : 240
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const barGroupW = innerW / numWeeks
  const barW = Math.max(barGroupW / displayRosters.length - 2, 3)

  const yScale = (v: number) => PAD.top + (1 - (v - minEff) / effRange) * innerH

  return (
    <div className="w-full overflow-x-auto flex justify-center">
      <svg width={W} height={H + 18} className="text-foreground flex-shrink-0">
        {[minEff, (minEff + maxEff) / 2, maxEff].map((v) => (
          <text key={v} x={PAD.left - 6} y={yScale(v) + 3} textAnchor="end" className="fill-muted-foreground text-[9px] font-mono">{v}%</text>
        ))}
        <line x1={PAD.left} y1={yScale(100)} x2={W - PAD.right} y2={yScale(100)} stroke="#22c55e" strokeWidth={0.5} strokeDasharray="3 2" opacity={0.4} />
        <line x1={PAD.left} y1={yScale(80)} x2={W - PAD.right} y2={yScale(80)} stroke="#f59e0b" strokeWidth={0.5} strokeDasharray="3 2" opacity={0.4} />
        {numWeeks > 1 && weeks.filter((_, i) => i % Math.max(1, Math.floor(numWeeks / 6)) === 0 || i === numWeeks - 1).map((w) => (
          <text key={w} x={PAD.left + (w - 1) * barGroupW + barGroupW / 2} y={H + 6} textAnchor="middle" className="fill-muted-foreground text-[9px] font-mono">W{w}</text>
        ))}
        {displayRosters.map((roster, ri) => (
          <g key={roster.roster_id}>
            {roster.weekly.map((week, wi) => {
              const x = PAD.left + wi * barGroupW + ri * (barGroupW / displayRosters.length)
              const effH = yScale(week.efficiency)
              const zeroH = yScale(maxEff)
              return (
                <rect
                  key={wi}
                  x={x}
                  y={effH}
                  width={barW}
                  height={Math.max(zeroH - effH, 1)}
                  fill={week.efficiency >= 90 ? '#22c55e' : week.efficiency >= 80 ? '#f59e0b' : '#ef4444'}
                  opacity={0.6}
                  rx={2}
                />
              )
            })}
          </g>
        ))}
        {displayRosters.length === 1 && (
          <text x={PAD.left + 4} y={H + 14} className="fill-muted-foreground text-[8px]">
            <tspan fill="#22c55e" fontSize="10">■</tspan> ≥90%
            <tspan fill="#f59e0b" fontSize="10" dx={8}>■</tspan> ≥80%
            <tspan fill="#ef4444" fontSize="10" dx={8}>■</tspan> &lt;80%
          </text>
        )}
        {displayRosters.length > 1 && displayRosters.map((roster, ri) => (
          <text key={ri} x={PAD.left + 4} y={H + 14 + ri * 12} className="fill-muted-foreground text-[8px]">
            <tspan fill={TEAM_COLORS[ri % TEAM_COLORS.length]} fontSize="10">●</tspan> {roster.name} ({roster.avg_efficiency.toFixed(0)}%)
          </text>
        ))}
      </svg>
    </div>
  )
}
