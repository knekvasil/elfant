import { useEffect, useState } from 'react'
import { Skeleton } from './ui/skeleton'
import { fetchTeamStats } from '../lib/api'
import type { TeamStatsData, Roster } from '../types'
import { cn } from '../lib/utils'
import Tooltip from './ui/tooltip'

interface Props {
  leagueId: string
  rosters: Roster[]
  hoveredRosterId?: number | null
  onHover?: (rosterId: number | null) => void
  onClick?: (rosterId: number) => void
  selectedRosterIds?: Set<number>
  highlightedRosterIds?: Set<number>
}

const TEAM_COLORS = [
  '#38bdf8', '#f472b6', '#a78bfa', '#34d399', '#fbbf24',
  '#fb923c', '#f87171', '#2dd4bf', '#818cf8', '#c084fc',
  '#4ade80', '#fde68a',
]

interface PowerRow {
  roster_id: number
  name: string
  raw: Record<string, number>
  norm: Record<string, number>
  composite: number
}

const RADAR_LABELS = ['PF', 'Eff', 'Cons.', 'Dom.', 'Rost.', 'LU']
const N_AXES = RADAR_LABELS.length

function polarPoint(cx: number, cy: number, r: number, value: number, i: number) {
  const angle = -Math.PI / 2 + (i / N_AXES) * 2 * Math.PI
  return { x: cx + (r * value) / 100 * Math.cos(angle), y: cy + (r * value) / 100 * Math.sin(angle) }
}

export default function PowerRankings({ leagueId, rosters, hoveredRosterId, onHover, onClick, highlightedRosterIds }: Props) {
  const [data, setData] = useState<TeamStatsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchTeamStats(leagueId)
      .then((d) => { if (!cancelled) setData(d) })
      .catch(() => { if (!cancelled) setData(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [leagueId])

  if (loading) return <Skeleton className="h-96 w-full" />
  if (!data || data.rosters.length === 0) return <div className="text-sm text-muted-foreground text-center py-12">No data available.</div>

  const weeks = data.weeks.length

  const keys = ['avgPf', 'efficiency', 'consistency', 'dominance', 'roster', 'lineup'] as const

  const rows: PowerRow[] = data.rosters.map((r) => {
    const roster = rosters.find(ro => ro.roster_id === r.roster_id)
    const name = roster?.team_name || r.name

    const avgPf = r.season_avg
    const efficiency = r.avg_efficiency
    const consistency = 1 - r.bust_rate
    const dominance = r.all_play_total > 0 ? (r.all_play_wins / r.all_play_total) * 100 : 0
    const rosterScore = r.weekly.reduce((s, w) => s + w.optimal, 0) / weeks
    const optWins = r.weekly.reduce((s, w) => s + w.optimal_wins, 0)
    const winsOnBench = optWins - (roster?.wins || 0)
    const lineup = Math.max(0, Math.min(100, 100 - (winsOnBench / weeks) * 100))

    return {
      roster_id: r.roster_id,
      name,
      raw: { avgPf, efficiency, consistency: consistency * 100, dominance, roster: rosterScore, lineup },
      norm: { avgPf, efficiency, consistency, dominance: dominance / 100, roster: rosterScore, lineup: lineup / 100 },
      composite: 0,
    }
  })

  for (const key of keys) {
    const vals = rows.map(r => r.norm[key])
    const max = Math.max(...vals) || 1
    for (const r of rows) {
      r.norm[key] = r.norm[key] / max
    }
  }

  for (const r of rows) {
    r.composite = keys.reduce((s, k) => s + r.norm[k], 0) / keys.length * 100
  }

  rows.sort((a, b) => b.composite - a.composite)

  const rosterColorMap = new Map<number, string>()
  const sortedById = [...rows].sort((a, b) => a.roster_id - b.roster_id)
  sortedById.forEach((r, i) => rosterColorMap.set(r.roster_id, TEAM_COLORS[i % TEAM_COLORS.length]))

  const hasActive = highlightedRosterIds !== undefined && highlightedRosterIds.size > 0
  const isHighlighted = (rid: number) => highlightedRosterIds?.has(rid) ?? false
  const isDimmed = (rid: number) => hasActive && !isHighlighted(rid)

  const W = 380
  const H = 360
  const cx = W / 2
  const cy = H / 2 + 10
  const radius = Math.min(cx, cy) - 50

  const ringPcts = [25, 50, 75, 100]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="rounded-lg border border-border/40 bg-card/30 p-3">
        <div className="text-xs font-semibold text-muted-foreground mb-3">Power Rankings</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2 px-2 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            <div className="w-5 flex-shrink-0">#</div>
            <div className="size-7 flex-shrink-0" />
            <div className="flex-1 min-w-0">Team</div>
            <div className="text-right flex-shrink-0 w-10">Score</div>
            <Tooltip content="Average weekly points for">
              <div className="text-right flex-shrink-0 w-10 cursor-help">PF</div>
            </Tooltip>
            <Tooltip content="Average lineup efficiency (actual ÷ optimal × 100)">
              <div className="text-right flex-shrink-0 w-10 cursor-help">Eff</div>
            </Tooltip>
            <Tooltip content="All-play win percentage — how often you beat the field">
              <div className="text-right flex-shrink-0 w-10 cursor-help">Dom</div>
            </Tooltip>
            <Tooltip content="Lineup score — how few wins you left on the bench">
              <div className="text-right flex-shrink-0 w-10 cursor-help">LU</div>
            </Tooltip>
          </div>
          {rows.map((r, i) => {
            const hl = isHighlighted(r.roster_id)
            const dm = isDimmed(r.roster_id)
            const color = rosterColorMap.get(r.roster_id)
            const isHovered = hoveredRosterId === r.roster_id
            return (
              <div
                key={r.roster_id}
                className={cn(
                  'flex items-center gap-2 px-2 py-1.5 rounded-md transition-all duration-200 cursor-pointer',
                  isHovered || hl ? 'bg-muted/40 ring-1 ring-border' : dm ? 'opacity-30' : 'hover:bg-muted/20',
                )}
                onMouseEnter={() => onHover?.(r.roster_id)}
                onMouseLeave={() => onHover?.(null)}
                onClick={() => onClick?.(r.roster_id)}
              >
                <div className="w-5 flex-shrink-0 text-center text-[11px] font-bold text-muted-foreground">{i + 1}</div>
                <div className="size-7 rounded-full bg-muted overflow-hidden flex-shrink-0 ring-1 ring-border">
                  {rosters.find(ro => ro.roster_id === r.roster_id)?.owner_avatar ? (
                    <img src={rosters.find(ro => ro.roster_id === r.roster_id)!.owner_avatar!} alt="" className="size-full object-cover" />
                  ) : (
                    <div className="size-full flex items-center justify-center text-[9px] font-bold text-muted-foreground">{r.name.charAt(0)}</div>
                  )}
                </div>
                <div className="flex-1 min-w-0 flex items-center gap-1.5">
                  <div className="size-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-xs font-semibold truncate">{r.name}</span>
                </div>
                <div className="text-xs font-bold tabular-nums text-right flex-shrink-0 w-10">{r.composite.toFixed(0)}</div>
                <div className="text-[10px] font-mono tabular-nums text-right flex-shrink-0 w-10 text-muted-foreground">{r.raw.avgPf.toFixed(0)}</div>
                <div className="text-[10px] font-mono tabular-nums text-right flex-shrink-0 w-10 text-muted-foreground">{r.raw.efficiency.toFixed(0)}</div>
                <div className="text-[10px] font-mono tabular-nums text-right flex-shrink-0 w-10 text-muted-foreground">{r.raw.dominance.toFixed(0)}</div>
                <div className="text-[10px] font-mono tabular-nums text-right flex-shrink-0 w-10 text-muted-foreground">{r.raw.lineup.toFixed(0)}</div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="rounded-lg border border-border/40 bg-card/30 p-3">
        <div className="text-xs font-semibold text-muted-foreground mb-3">
          Radar — {hasActive && highlightedRosterIds?.size === 1
            ? rosters.find(r => r.roster_id === [...highlightedRosterIds!][0])?.team_name || `Team ${[...highlightedRosterIds!][0]}`
            : 'All Teams'}
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full max-h-[360px]">
          {ringPcts.map((pct) => {
            const r = (radius * pct) / 100
            const pts = Array.from({ length: N_AXES }, (_, i) => polarPoint(cx, cy, r, 100, i))
            return (
              <polygon key={pct} points={pts.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="currentColor" className="text-border/20" strokeWidth={0.5} />
            )
          })}
          {Array.from({ length: N_AXES }, (_, i) => {
            const p = polarPoint(cx, cy, radius, 100, i)
            return (
              <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="currentColor" className="text-border/20" strokeWidth={0.5} />
            )
          })}
          {RADAR_LABELS.map((label, i) => {
            const p = polarPoint(cx, cy, radius + 16, 100, i)
            return (
              <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground" fontSize="9" fontFamily="monospace">
                {label}
              </text>
            )
          })}
          {rows.map((r) => {
            const hl = isHighlighted(r.roster_id)
            const dm = isDimmed(r.roster_id)
            const color = rosterColorMap.get(r.roster_id)
            const pts = keys.map((key, i) => {
              const val = Math.round(r.norm[key] * 100)
              const p = polarPoint(cx, cy, radius, val, i)
              return `${p.x},${p.y}`
            }).join(' ')
            if (dm) return null
            return (
              <polygon key={r.roster_id} points={pts} fill={color} fillOpacity={hl ? 0.25 : 0.1} stroke={color} strokeWidth={hl ? 2 : 0.8} strokeOpacity={hl ? 1 : 0.3} className="transition-all duration-200" />
            )
          })}
        </svg>
      </div>
    </div>
  )
}
