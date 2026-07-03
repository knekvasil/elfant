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

  const yScale = (v: number) => PAD.top + (1 - (v - minEff) / effRange) * innerH

  if (displayRosters.length === 1) {
    const roster = displayRosters[0]
    const barW = Math.max(innerW / numWeeks - 4, 4)

    return (
      <div className="w-full h-full">
        <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full h-full text-foreground">
          {[minEff, (minEff + maxEff) / 2, maxEff].map((v) => (
            <text key={v} x={PAD.left - 6} y={yScale(v) + 3} textAnchor="end" className="fill-muted-foreground text-[9px] font-mono">{v}%</text>
          ))}
          <line x1={PAD.left} y1={yScale(100)} x2={W - PAD.right} y2={yScale(100)} stroke="#22c55e" strokeWidth={0.5} strokeDasharray="3 2" opacity={0.4} />
          <line x1={PAD.left} y1={yScale(80)} x2={W - PAD.right} y2={yScale(80)} stroke="#f59e0b" strokeWidth={0.5} strokeDasharray="3 2" opacity={0.4} />
          {numWeeks > 1 && weeks.filter((_, i) => i % Math.max(1, Math.floor(numWeeks / 6)) === 0 || i === numWeeks - 1).map((w) => (
            <text key={w} x={PAD.left + (w - 1) * (innerW / numWeeks) + (innerW / numWeeks) / 2} y={H + 6} textAnchor="middle" className="fill-muted-foreground text-[9px] font-mono">W{w}</text>
          ))}
          {roster.weekly.map((week, wi) => {
            const x = PAD.left + wi * (innerW / numWeeks) + 2
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
                opacity={0.7}
                rx={2}
              />
            )
          })}
          <text x={PAD.left + 4} y={H + 14} className="fill-muted-foreground text-[8px]">
            <tspan fill="#22c55e" fontSize="10">■</tspan> ≥90%
            <tspan fill="#f59e0b" fontSize="10" dx={8}>■</tspan> ≥80%
            <tspan fill="#ef4444" fontSize="10" dx={8}>■</tspan> &lt;80%
          </text>
        </svg>
      </div>
    )
  }

  const hasSelection = highlightedRosterIds !== undefined && highlightedRosterIds.size > 0
  const isHighlighted = (rid: number) => highlightedRosterIds?.has(rid) ?? false
  const isDimmed = (rid: number) => hasSelection && !isHighlighted(rid)
  const allRosters = rosters

  const xScale = (week: number) => PAD.left + ((week - 1) / (numWeeks - 1)) * innerW

  return (
    <div className="w-full h-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full text-foreground">
        <line x1={PAD.left} y1={yScale(100)} x2={W - PAD.right} y2={yScale(100)} stroke="#22c55e" strokeWidth={0.5} strokeDasharray="3 2" opacity={0.4} />
        <line x1={PAD.left} y1={yScale(90)} x2={W - PAD.right} y2={yScale(90)} stroke="#22c55e" strokeWidth={0.5} strokeDasharray="2 2" opacity={0.2} />
        <line x1={PAD.left} y1={yScale(80)} x2={W - PAD.right} y2={yScale(80)} stroke="#f59e0b" strokeWidth={0.5} strokeDasharray="3 2" opacity={0.4} />
        {[minEff, 80, 90, 100].map((v) => (
          <text key={v} x={PAD.left - 6} y={yScale(v) + 3} textAnchor="end" className="fill-muted-foreground text-[9px] font-mono">{v}%</text>
        ))}
        {numWeeks > 1 && weeks.filter((_, i) => i % Math.max(1, Math.floor(numWeeks / 6)) === 0 || i === numWeeks - 1).map((w) => (
          <text key={w} x={xScale(w)} y={H - 6} textAnchor="middle" className="fill-muted-foreground text-[9px] font-mono">W{w}</text>
        ))}
        {allRosters.map((roster, ri) => {
          const hl = isHighlighted(roster.roster_id)
          const dm = isDimmed(roster.roster_id)
          const color = TEAM_COLORS[ri % TEAM_COLORS.length]
          const pts = roster.weekly.map((w, i) => `${xScale(i + 1)},${yScale(w.efficiency)}`).join(' ')
          return (
            <path key={roster.roster_id} d={`M ${pts}`} fill="none" stroke={color} strokeWidth={hl ? 2.5 : 1.5}
              strokeLinejoin="round" strokeLinecap="round" opacity={dm ? 0.08 : hl ? 1 : 0.35}
              className="transition-all duration-200 pointer-events-none" />
          )
        })}
        {allRosters.map((roster, ri) => {
          const hl = isHighlighted(roster.roster_id)
          const dm = isDimmed(roster.roster_id)
          if (dm) return null
          const lastV = roster.weekly[roster.weekly.length - 1].efficiency
          return (
            <circle key={`dot-${roster.roster_id}`} cx={xScale(numWeeks)} cy={yScale(lastV)} r={hl ? 4 : 2.5}
              fill={hl ? TEAM_COLORS[ri % TEAM_COLORS.length] : 'currentColor'} className="text-foreground/60 transition-all duration-200"
              opacity={dm ? 0.08 : hl ? 1 : 0.6} />
          )
        })}
      </svg>
    </div>
  )
}
