import { useEffect, useState } from 'react'
import { Skeleton } from './ui/skeleton'
import { fetchTeamStats } from '../lib/api'
import type { TeamStatsData, Roster } from '../types'
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts'
import { cn } from '../lib/utils'
import Tooltip from './ui/tooltip'

interface Props {
  leagueId: string
  rosters: Roster[]
}

const TEAM_COLORS = [
  '#38bdf8', '#f472b6', '#a78bfa', '#34d399', '#fbbf24',
  '#fb923c', '#f87171', '#2dd4bf', '#818cf8', '#c084fc',
  '#4ade80', '#fde68a',
]

function rankHue(index: number, total: number): number {
  return 120 - (total > 1 ? (index / (total - 1)) : 0) * 120
}

interface PowerRow {
  roster_id: number
  name: string
  raw: Record<string, number>
  norm: Record<string, number>
  composite: number
}

export default function PowerRankings({ leagueId, rosters }: Props) {
  const [data, setData] = useState<TeamStatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)

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
  const keyLabels: Record<string, string> = {
    avgPf: 'Points For',
    efficiency: 'Efficiency',
    consistency: 'Consistency',
    dominance: 'Dominance',
    roster: 'Roster',
    lineup: 'Lineup',
  }

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
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const range = max - min || 1
    for (const r of rows) {
      r.norm[key] = (r.norm[key] - min) / range
    }
  }

  for (const r of rows) {
    r.composite = keys.reduce((s, k) => s + r.norm[k], 0) / keys.length * 100
  }

  rows.sort((a, b) => b.composite - a.composite)

  const radarData = keys.map((key) => {
    const entry: Record<string, string | number> = { metric: keyLabels[key] }
    for (const r of rows) {
      entry[r.roster_id] = Math.round(r.norm[key] * 100)
    }
    return entry
  })

  const rosterColorMap = new Map<number, string>()
  const sortedById = [...rows].sort((a, b) => a.roster_id - b.roster_id)
  sortedById.forEach((r, i) => rosterColorMap.set(r.roster_id, TEAM_COLORS[i % TEAM_COLORS.length]))

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
            const isSelected = selectedId === r.roster_id
            const color = rosterColorMap.get(r.roster_id)
            return (
              <div
                key={r.roster_id}
                className={cn(
                  'flex items-center gap-2 px-2 py-1.5 rounded-md transition-all duration-200 cursor-pointer',
                  isSelected ? 'ring-1 ring-border' : 'hover:ring-1 hover:ring-border/60',
                )}
                style={{ backgroundColor: isSelected ? `hsla(${rankHue(i, rows.length)}, 65%, 40%, 0.35)` : `hsla(${rankHue(i, rows.length)}, 55%, 35%, 0.15)` }}
                onClick={() => setSelectedId(isSelected ? null : r.roster_id)}
              >
                <div className="w-5 flex-shrink-0 text-center text-[11px] font-bold" style={{ color: `hsl(${rankHue(i, rows.length)}, 75%, 45%)` }}>{i + 1}</div>
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
        <div className="text-xs font-semibold text-muted-foreground mb-3">Radar — {selectedId ? rosters.find(r => r.roster_id === selectedId)?.team_name || `Team ${selectedId}` : 'All Teams'}</div>
        <div className="w-full aspect-square max-h-[420px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData}>
              <PolarGrid stroke="currentColor" className="text-border/30" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: 'currentColor' }} className="text-muted-foreground" />
              <PolarRadiusAxis tick={false} axisLine={false} />
              {rows.map((r) => {
                const isActive = selectedId === null || selectedId === r.roster_id
                const isDimmed = selectedId !== null && selectedId !== r.roster_id
                const color = rosterColorMap.get(r.roster_id)
                return (
                  <Radar
                    key={r.roster_id}
                    name={r.name}
                    dataKey={r.roster_id}
                    stroke={color}
                    fill={color}
                    fillOpacity={isDimmed ? 0.03 : isActive ? 0.12 : 0.06}
                    strokeWidth={isDimmed ? 0.5 : isActive ? 2 : 0.8}
                    strokeOpacity={isDimmed ? 0.12 : isActive ? 0.8 : 0.25}
                    animationDuration={0}
                  />
                )
              })}
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
