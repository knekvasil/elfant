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

export default function WeeklyBarChart({ leagueId, highlightedRosterIds, compact }: Props) {
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

  const hasSelection = highlightedRosterIds !== undefined && highlightedRosterIds.size > 0
  if (!hasSelection) return <div className="text-sm text-muted-foreground text-center py-6">Click a team to view weekly breakdown.</div>

  const { weeks, rosters } = data
  const numWeeks = weeks.length
  const activeRosters = rosters.filter(r => highlightedRosterIds?.has(r.roster_id))

  const rosterColorMap = new Map<number, string>()
  const sortedById = [...rosters].sort((a, b) => a.roster_id - b.roster_id)
  sortedById.forEach((r, i) => rosterColorMap.set(r.roster_id, TEAM_COLORS[i % TEAM_COLORS.length]))

  const allVals = rosters.flatMap(r => r.weekly.flatMap(w => [w.pf, w.pa, w.league_avg]))
  const maxVal = Math.max(...allVals, 100)
  const minVal = 0

  const PAD = { top: 10, right: 12, bottom: 24, left: 34 }
  const W = compact ? 380 : 520
  const H = compact ? 150 : 240
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const barGroupW = innerW / numWeeks

  const yScale = (v: number) => PAD.top + (1 - (v - minVal) / (maxVal - minVal)) * innerH

  return (
    <div className="w-full h-full">
      <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full h-full text-foreground">
        {[0, Math.round(maxVal / 2), maxVal].map((v) => (
          <text key={v} x={PAD.left - 6} y={yScale(v) + 3} textAnchor="end" className="fill-muted-foreground text-[9px] font-mono">{v}</text>
        ))}
        {numWeeks > 1 && weeks.filter((_, i) => i % Math.max(1, Math.floor(numWeeks / 6)) === 0 || i === numWeeks - 1).map((w) => (
          <text key={w} x={PAD.left + (w - 1) * barGroupW + barGroupW / 2} y={H + 6} textAnchor="middle" className="fill-muted-foreground text-[9px] font-mono">W{w}</text>
        ))}
        {activeRosters.length === 1 && activeRosters[0].weekly.map((week, wi) => {
          const x = PAD.left + wi * barGroupW
          const barW = barGroupW / 4
          const pfH = yScale(week.pf)
          const paH = yScale(week.pa)
          const avgH = yScale(week.league_avg)
          return (
            <g key={wi}>
              <rect x={x} y={pfH} width={barW} height={yScale(0) - pfH} fill="#22c55e" fillOpacity={0.6} rx={2} />
              <rect x={x + barW} y={paH} width={barW} height={yScale(0) - paH} fill="#ef4444" fillOpacity={0.5} rx={2} />
              <rect x={x + barW * 2} y={avgH} width={barW} height={yScale(0) - avgH} fill="#a78bfa" fillOpacity={0.5} rx={2} />
              {week.optimal > 0 && (
                <line x1={x} x2={x + barW * 3} y1={yScale(week.optimal)} y2={yScale(week.optimal)} stroke="#fbbf24" strokeWidth={1} strokeDasharray="3 2" opacity={0.6} />
              )}
            </g>
          )
        })}
        {activeRosters.length === 1 && (
          <g>
            <rect x={PAD.left} y={H + 14} width={8} height={8} fill="#22c55e" fillOpacity={0.6} rx={1} />
            <text x={PAD.left + 11} y={H + 21} className="fill-muted-foreground text-[8px]">PF</text>
            <rect x={PAD.left + 30} y={H + 14} width={8} height={8} fill="#ef4444" fillOpacity={0.5} rx={1} />
            <text x={PAD.left + 41} y={H + 21} className="fill-muted-foreground text-[8px]">PA</text>
            <rect x={PAD.left + 60} y={H + 14} width={8} height={8} fill="#a78bfa" fillOpacity={0.5} rx={1} />
            <text x={PAD.left + 71} y={H + 21} className="fill-muted-foreground text-[8px]">Avg</text>
            <line x1={PAD.left + 90} x2={PAD.left + 98} y1={H + 18} y2={H + 18} stroke="#fbbf24" strokeWidth={1} strokeDasharray="3 2" opacity={0.6} />
            <text x={PAD.left + 101} y={H + 21} className="fill-muted-foreground text-[8px]">Optimal</text>
          </g>
        )}
        {activeRosters.length > 1 && activeRosters.map((roster, ri) => {
          const color = rosterColorMap.get(roster.roster_id) || TEAM_COLORS[ri % TEAM_COLORS.length]
          return (
            <g key={roster.roster_id}>
              {roster.weekly.map((week, wi) => {
                const x = PAD.left + wi * barGroupW + ri * (barGroupW / activeRosters.length)
                const barW = Math.max(barGroupW / activeRosters.length - 2, 2)
                const h = yScale(week.pf)
                return (
                  <rect key={wi} x={x} y={h} width={barW} height={yScale(0) - h} fill={color} rx={2} opacity={0.6} />
                )
              })}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
