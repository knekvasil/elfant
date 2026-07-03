import { Skeleton } from '../components/ui/skeleton'
import { fetchRankings } from '../lib/api'
import { useEffect, useState } from 'react'
import type { RankingsData } from '../types'

interface Props {
  leagueId: string
  highlightedRosterIds?: Set<number>
  mode?: string
  compact?: boolean
}

const COLORS = [
  '#38bdf8', '#f472b6', '#a78bfa', '#34d399', '#fbbf24',
  '#fb923c', '#f87171', '#2dd4bf', '#818cf8', '#c084fc',
  '#4ade80', '#fde68a',
]

export default function PointsDiffChart({ leagueId, highlightedRosterIds, mode = 'standard', compact }: Props) {
  const [data, setData] = useState<RankingsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchRankings(leagueId, mode)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [leagueId, mode])

  if (loading) return <Skeleton className="h-48 w-full" />
  if (!data || data.rosters.length === 0) return <div className="text-sm text-muted-foreground text-center py-6">No data available.</div>

  const { weeks, rosters } = data
  const hasActive = highlightedRosterIds !== undefined && highlightedRosterIds.size > 0
  const isHighlighted = (rid: number) => highlightedRosterIds?.has(rid) ?? false
  const isDimmed = (rid: number) => hasActive && !isHighlighted(rid)

  const numWeeks = weeks.length
  const allDiffs = rosters.flatMap((r) => r.pf_diffs)
  const yMin = mode === 'efficiency' ? 0 : -Math.max(...allDiffs.map(Math.abs), 100) - 20
  const yMax = Math.max(...allDiffs, 100) + 20

  const rightPad = mode === 'efficiency' ? 36 : 12
  const PAD = { top: 10, right: rightPad, bottom: 22, left: 38 }
  const W = compact ? 380 : 520
  const Wadj = mode === 'efficiency' ? W + 24 : W
  const H = compact ? 150 : 240
  const innerW = Wadj - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const xScale = (week: number) => PAD.left + ((week - 1) / (numWeeks - 1)) * innerW
  const yScale = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * innerH

  let highlightedRoster: typeof rosters[0] | undefined
  let weeklyVals: number[] = []
  let weeklyMin = 0, weeklyMax = 100
  if (mode === 'efficiency' && hasActive) {
    highlightedRoster = rosters.find(r => isHighlighted(r.roster_id))
    if (highlightedRoster) {
      weeklyVals = highlightedRoster.pf_diffs.map((v, i) => i === 0 ? v : v - highlightedRoster!.pf_diffs[i - 1])
      weeklyMin = 0
      weeklyMax = Math.max(...weeklyVals, 100)
    }
  }
  const weeklyScale = (v: number) => PAD.top + (1 - (v - weeklyMin) / (weeklyMax - weeklyMin)) * innerH

  return (
    <div className="w-full h-full">
      <svg viewBox={`0 0 ${Wadj} ${H}`} className="w-full h-full text-foreground">
        <line x1={PAD.left} y1={yScale(0)} x2={Wadj - PAD.right} y2={yScale(0)} stroke="currentColor" className="text-border/60" strokeWidth={1} strokeDasharray="4 3" />
        {(mode === 'efficiency' ? [0, Math.round(yMax / 2), yMax] : [yMin, 0, yMax]).map((v) => (
          <text key={v} x={PAD.left - 6} y={yScale(v) + 3} textAnchor="end" className="fill-muted-foreground text-[9px] font-mono">{v > 0 ? '+' : ''}{v}</text>
        ))}
        {mode === 'efficiency' && highlightedRoster && [weeklyMin, Math.round(weeklyMax / 2), weeklyMax].map((v) => (
          <text key={`r-${v}`} x={Wadj - PAD.right + 6} y={weeklyScale(v) + 3} textAnchor="start" className="fill-muted-foreground text-[8px] font-mono">{v}</text>
        ))}
        {numWeeks > 1 && weeks.filter((_, i) => i % Math.max(1, Math.floor(numWeeks / 6)) === 0 || i === numWeeks - 1).map((w) => (
          <text key={w} x={xScale(w)} y={H - 6} textAnchor="middle" className="fill-muted-foreground text-[9px] font-mono">W{w}</text>
        ))}
        {rosters.map((roster, ri) => {
          const hl = isHighlighted(roster.roster_id)
          const dm = isDimmed(roster.roster_id)
          const color = COLORS[ri % COLORS.length]
          const pts = roster.pf_diffs.map((v, i) => `${xScale(i + 1)},${yScale(v)}`).join(' ')
          return (
            <g key={roster.roster_id} className="transition-all duration-200 pointer-events-none">
              {mode === 'efficiency' && (
                <path d={`M ${xScale(1)},${yScale(0)} L ${pts} L ${xScale(numWeeks)},${yScale(0)} Z`}
                  fill={color} stroke="none" opacity={dm ? 0.05 : hl ? 0.35 : 0.15} />
              )}
              <path d={`M ${pts}`} fill="none" stroke={color} strokeWidth={hl ? 2.5 : 1.5}
                strokeLinejoin="round" strokeLinecap="round" opacity={dm ? 0.08 : hl ? 1 : 0.35} />
              {mode === 'efficiency' && hl && (
                <path d={`M ${weeklyVals.map((v, i) => `${xScale(i + 1)},${weeklyScale(v)}`).join(' ')}`} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray="4 2"
                  strokeLinejoin="round" strokeLinecap="round" opacity={0.7} />
              )}
            </g>
          )
        })}
        {rosters.map((roster, ri) => {
          const hl = isHighlighted(roster.roster_id)
          const dm = isDimmed(roster.roster_id)
          if (dm) return null
          const lastV = roster.pf_diffs[roster.pf_diffs.length - 1]
          return (
            <circle key={`dot-${roster.roster_id}`} cx={xScale(numWeeks)} cy={yScale(lastV)} r={hl ? 4 : 2.5}
              fill={hl ? COLORS[ri % COLORS.length] : 'currentColor'} className="text-foreground/60 transition-all duration-200"
              opacity={dm ? 0.08 : hl ? 1 : 0.6} />
          )
        })}
      </svg>
    </div>
  )
}
