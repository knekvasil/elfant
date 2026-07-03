import { Skeleton } from '../components/ui/skeleton'
import { fetchRankings } from '../lib/api'
import { useEffect, useState } from 'react'
import type { RankingsData } from '../types'

interface Props {
  leagueId: string
  highlightedRosterIds?: Set<number>
  mode?: 'standard' | 'median'
}

const COLORS = [
  '#38bdf8', '#f472b6', '#a78bfa', '#34d399', '#fbbf24',
  '#fb923c', '#f87171', '#2dd4bf', '#818cf8', '#c084fc',
  '#4ade80', '#fde68a',
]

export default function RankingsChart({ leagueId, highlightedRosterIds, mode = 'standard' }: Props) {
  const [data, setData] = useState<RankingsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchRankings(leagueId, mode)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [leagueId, mode])

  if (loading) return <Skeleton className="h-64 w-full" />
  if (!data || data.rosters.length === 0) return <div className="text-sm text-muted-foreground text-center py-8">No ranking data available.</div>

  const { weeks, rosters } = data
  const numWeeks = weeks.length
  const numTeams = rosters.length
  const hasActive = highlightedRosterIds !== undefined && highlightedRosterIds.size > 0
  const isHighlighted = (rid: number) => highlightedRosterIds?.has(rid) ?? false
  const isDimmed = (rid: number) => hasActive && !isHighlighted(rid)

  const PAD = { top: 16, right: 16, bottom: 28, left: 32 }
  const W = 520
  const H = 320
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const xScale = (week: number) => PAD.left + ((week - 1) / (numWeeks - 1)) * innerW
  const yScale = (rank: number) => PAD.top + ((rank - 1) / (numTeams - 1)) * innerH

  return (
    <div className="w-full overflow-x-auto flex justify-center">
      <svg width={W} height={H} className="text-foreground flex-shrink-0">
        {[1, Math.ceil(numTeams / 2), numTeams].map((r) => (
          <text key={r} x={PAD.left - 6} y={yScale(r) + 3} textAnchor="end" className="fill-muted-foreground text-[9px] font-mono">#{r}</text>
        ))}
        {numWeeks > 1 && weeks.filter((_, i) => i % Math.max(1, Math.floor(numWeeks / 6)) === 0 || i === numWeeks - 1).map((w) => (
          <text key={w} x={xScale(w)} y={H - 6} textAnchor="middle" className="fill-muted-foreground text-[9px] font-mono">W{w}</text>
        ))}
        {Array.from({ length: numTeams }, (_, i) => i + 1).map((r) => (
          <line key={`g-${r}`} x1={PAD.left} y1={yScale(r)} x2={W - PAD.right} y2={yScale(r)} stroke="currentColor" className="text-border/40" strokeWidth={0.5} />
        ))}
        {rosters.map((roster, ri) => {
          const hl = isHighlighted(roster.roster_id)
          const dm = isDimmed(roster.roster_id)
          const color = COLORS[ri % COLORS.length]
          const pts = roster.rankings.map((r, i) => `${xScale(i + 1)},${yScale(r)}`).join(' ')
          return (
            <g key={roster.roster_id}>
              <path d={`M ${pts}`} fill="none" stroke={color} strokeWidth={hl ? 2.5 : 1.5} strokeLinejoin="round" strokeLinecap="round" opacity={dm ? 0.08 : hl ? 1 : 0.35} className="transition-all duration-200 pointer-events-none" />
            </g>
          )
        })}
        {rosters.map((roster, ri) => {
          const hl = isHighlighted(roster.roster_id)
          const dm = isDimmed(roster.roster_id)
          if (dm) return null
          const lastR = roster.rankings[roster.rankings.length - 1]
          return (
            <circle key={`dot-${roster.roster_id}`} cx={xScale(numWeeks)} cy={yScale(lastR)} r={hl ? 4 : 2.5}
              fill={hl ? COLORS[ri % COLORS.length] : 'currentColor'} className="text-foreground/60 transition-all duration-200" opacity={dm ? 0.08 : hl ? 1 : 0.6} />
          )
        })}
      </svg>
    </div>
  )
}
