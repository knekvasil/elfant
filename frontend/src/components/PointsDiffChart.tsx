import { Skeleton } from '../components/ui/skeleton'
import { fetchRankings } from '../lib/api'
import { useEffect, useState } from 'react'
import type { RankingsData } from '../types'

interface Props {
  leagueId: string
  highlightedRosterIds?: Set<number>
}

const COLORS = [
  '#38bdf8', '#f472b6', '#a78bfa', '#34d399', '#fbbf24',
  '#fb923c', '#f87171', '#2dd4bf', '#818cf8', '#c084fc',
  '#4ade80', '#fde68a',
]

export default function PointsDiffChart({ leagueId, highlightedRosterIds }: Props) {
  const [data, setData] = useState<RankingsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchRankings(leagueId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [leagueId])

  if (loading) return <Skeleton className="h-48 w-full" />
  if (!data || data.rosters.length === 0) return <div className="text-sm text-muted-foreground text-center py-6">No data available.</div>

  const { weeks, rosters } = data
  const hasActive = highlightedRosterIds !== undefined && highlightedRosterIds.size > 0
  const isHighlighted = (rid: number) => highlightedRosterIds?.has(rid) ?? false
  const isDimmed = (rid: number) => hasActive && !isHighlighted(rid)

  const numWeeks = weeks.length
  const allDiffs = rosters.flatMap((r) => r.pf_diffs)
  const maxAbs = Math.max(...allDiffs.map(Math.abs), 100)
  const yMin = -maxAbs - 20
  const yMax = maxAbs + 20

  const PAD = { top: 12, right: 16, bottom: 28, left: 44 }
  const W = 520
  const H = 240
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const xScale = (week: number) => PAD.left + ((week - 1) / (numWeeks - 1)) * innerW
  const yScale = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * innerH

  return (
    <div className="w-full overflow-x-auto flex justify-center">
      <svg width={W} height={H} className="text-foreground flex-shrink-0">
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
