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
    let cancelled = false
    setLoading(true)
    fetchRankings(leagueId, mode)
      .then((d) => { if (!cancelled) setData(d) })
      .catch(() => { if (!cancelled) setData(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [leagueId, mode])

  if (loading) return <Skeleton className="h-48 w-full" />
  if (!data || data.rosters.length === 0) return <div className="text-sm text-muted-foreground text-center py-6">No data available.</div>

  const { weeks, rosters } = data
  const hasActive = highlightedRosterIds !== undefined && highlightedRosterIds.size > 0
  const isHighlighted = (rid: number) => highlightedRosterIds?.has(rid) ?? false
  const isDimmed = (rid: number) => hasActive && !isHighlighted(rid)

  const numWeeks = weeks.length
  const allDiffs = rosters.flatMap((r) => r.pf_diffs)

  if (mode === 'efficiency') {
    const weeklyAll = rosters.flatMap(r =>
      r.pf_diffs.map((v, i) => i === 0 ? v : v - r.pf_diffs[i - 1])
    )
    const rawMax = Math.max(...weeklyAll, 100)
    const yMin = 0
    const yMax = Math.min(rawMax + 10, 10000)

    const PAD = { top: 10, right: 12, bottom: 22, left: 38 }
    const W = compact ? 380 : 520
    const H = compact ? 150 : 240
    const innerW = W - PAD.left - PAD.right
    const innerH = H - PAD.top - PAD.bottom
    const barGroupW = innerW / numWeeks
    const numTeams = rosters.length
    const barW = Math.max(barGroupW / numTeams - 2, 2)

    const yScale = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * innerH

    return (
      <div className="w-full h-full">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full text-foreground">
          <line x1={PAD.left} y1={yScale(0)} x2={W - PAD.right} y2={yScale(0)} stroke="currentColor" className="text-border/60" strokeWidth={1} strokeDasharray="4 3" />
          {[0, Math.round(yMax / 2), yMax].map((v) => (
            <text key={v} x={PAD.left - 6} y={yScale(v) + 3} textAnchor="end" className="fill-muted-foreground text-[9px] font-mono">{v}</text>
          ))}
          {numWeeks > 1 && weeks.filter((_, i) => i % Math.max(1, Math.floor(numWeeks / 6)) === 0 || i === numWeeks - 1).map((w) => (
            <text key={w} x={PAD.left + (w - 1) * barGroupW + barGroupW / 2} y={H - 6} textAnchor="middle" className="fill-muted-foreground text-[9px] font-mono">W{w}</text>
          ))}
          {rosters.map((roster, ri) => {
            const hl = isHighlighted(roster.roster_id)
            const dm = isDimmed(roster.roster_id)
            const color = COLORS[ri % COLORS.length]
            return (
              <g key={roster.roster_id} opacity={dm ? 0.12 : hl ? 1 : 0.5} className="transition-all duration-200 pointer-events-none">
                {roster.pf_diffs.map((v, wi) => {
                  const weekly = wi === 0 ? v : v - roster.pf_diffs[wi - 1]
                  const x = PAD.left + wi * barGroupW + ri * (barGroupW / numTeams)
                  const h = yScale(weekly)
                  return (
                    <rect key={wi} x={x} y={h} width={barW} height={Math.max(yScale(0) - h, 1)} fill={color} rx={2} opacity={0.7} />
                  )
                })}
              </g>
            )
          })}
        </svg>
      </div>
    )
  }

  const yMin = -Math.max(...allDiffs.map(Math.abs), 100) - 20
  const yMax = Math.max(...allDiffs, 100) + 20

  const PAD = { top: 10, right: 12, bottom: 22, left: 38 }
  const W = compact ? 380 : 520
  const H = compact ? 150 : 240
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const xScale = (week: number) => PAD.left + ((week - 1) / (numWeeks - 1)) * innerW
  const yScale = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * innerH

  return (
    <div className="w-full h-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full text-foreground">
        <line x1={PAD.left} y1={yScale(0)} x2={W - PAD.right} y2={yScale(0)} stroke="currentColor" className="text-border/60" strokeWidth={1} strokeDasharray="4 3" />
        {[yMin, 0, yMax].map((v) => (
          <text key={v} x={PAD.left - 6} y={yScale(v) + 3} textAnchor="end" className="fill-muted-foreground text-[9px] font-mono">{v > 0 ? '+' : ''}{v}</text>
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
            <path key={roster.roster_id} d={`M ${pts}`} fill="none" stroke={color} strokeWidth={hl ? 2.5 : 1.5}
              strokeLinejoin="round" strokeLinecap="round" opacity={dm ? 0.08 : hl ? 1 : 0.35}
              className="transition-all duration-200 pointer-events-none" />
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
