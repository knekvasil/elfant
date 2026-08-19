import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart3, TrendingUp, Activity, ChevronDown, ChevronUp } from 'lucide-react'
import { Badge } from './ui/badge'
import Tooltip from './ui/tooltip'
import EmptyState from './ui/empty-state'
import { cn } from '../lib/utils'
import { fetchProjections } from '../lib/api'
import type { ProjectionPlayer, ProjectionResponse } from '../types'

interface Props {
  leagueId: string
  groupId: string
  tabParam?: string | null
}

const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'] as const

const positionStyles: Record<string, { bg: string; border: string; text: string }> = {
  QB: { bg: 'bg-sky-500/15', border: 'border-sky-500/30', text: 'text-sky-300' },
  RB: { bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-300' },
  WR: { bg: 'bg-violet-500/15', border: 'border-violet-500/30', text: 'text-violet-300' },
  TE: { bg: 'bg-amber-500/15', border: 'border-amber-500/30', text: 'text-amber-300' },
  K:  { bg: 'bg-zinc-500/15', border: 'border-zinc-500/30', text: 'text-zinc-300' },
  DEF:{ bg: 'bg-red-500/15', border: 'border-red-500/30', text: 'text-red-300' },
}
const defaultStyle = { bg: 'bg-zinc-500/10', border: 'border-zinc-500/20', text: 'text-zinc-300' }

type SortKey = 'projected_points' | 'overall_rank' | 'position_rank' | 'confidence' | 'name'

const STAT_LABELS: Record<string, string> = {
  attempts: 'Att',
  completions: 'Comp',
  passing_yards: 'Pass Yds',
  passing_tds: 'Pass TD',
  passing_interceptions: 'INT',
  carries: 'Car',
  rushing_yards: 'Rush Yds',
  rushing_tds: 'Rush TD',
  targets: 'Tgt',
  receptions: 'Rec',
  receiving_yards: 'Rec Yds',
  receiving_tds: 'Rec TD',
  fg_made: 'FG',
  pat_made: 'PAT',
}

function confidenceLabel(c: number): { label: string; cls: string } {
  if (c >= 0.66) return { label: 'High', cls: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30' }
  if (c >= 0.33) return { label: 'Med', cls: 'text-amber-300 bg-amber-500/15 border-amber-500/30' }
  return { label: 'Low', cls: 'text-red-300 bg-red-500/15 border-red-500/30' }
}

export default function DraftProjections({ leagueId, groupId, tabParam }: Props) {
  const navigate = useNavigate()
  const [data, setData] = useState<ProjectionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [position, setPosition] = useState<string>('ALL')
  const [sortKey, setSortKey] = useState<SortKey>('projected_points')
  const [sortDesc, setSortDesc] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetchProjections(leagueId)
      .then((d) => setData(d))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load projections'))
      .finally(() => setLoading(false))
  }, [leagueId])

  const toggleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDesc((d) => !d)
        return prev
      }
      setSortDesc(true)
      return key
    })
  }, [])

  const toggleExpand = useCallback((pid: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(pid)) next.delete(pid)
      else next.add(pid)
      return next
    })
  }, [])

  const players = useMemo(() => {
    if (!data) return []
    let list = data.players
    if (position !== 'ALL') list = list.filter((p) => p.position === position)
    const dir = sortDesc ? -1 : 1
    return [...list].sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name) * dir
      const av = a[sortKey] ?? 0
      const bv = b[sortKey] ?? 0
      if (av === bv) return 0
      return (av > bv ? 1 : -1) * dir
    })
  }, [data, position, sortKey, sortDesc])

  const playerCounts = useMemo(() => {
    if (!data) return {} as Record<string, number>
    const counts: Record<string, number> = {}
    for (const p of data.players) counts[p.position] = (counts[p.position] || 0) + 1
    return counts
  }, [data])

  const totalsByPos = useMemo(() => {
    if (!data) return {} as Record<string, { avg: number; top: number }>
    const byPos: Record<string, { sum: number; n: number; top: number }> = {}
    for (const p of data.players) {
      const e = byPos[p.position] || { sum: 0, n: 0, top: 0 }
      e.sum += p.projected_points
      e.n += 1
      e.top = Math.max(e.top, p.projected_points)
      byPos[p.position] = e
    }
    const out: Record<string, { avg: number; top: number }> = {}
    for (const [pos, e] of Object.entries(byPos)) {
      out[pos] = { avg: e.n ? Math.round(e.sum / e.n) : 0, top: Math.round(e.top) }
    }
    return out
  }, [data])

  const totalPoints = useMemo(() => data?.players.reduce((s, p) => s + p.projected_points, 0) || 0, [data])

  if (loading) {
    return <div className="text-sm text-muted-foreground text-center py-10">Loading projections…</div>
  }

  if (error) {
    return (
      <EmptyState
        icon={<BarChart3 className="size-8 text-muted-foreground/30" />}
        title="Couldn't load projections"
        description={error}
      />
    )
  }

  if (!data || data.players.length === 0) {
    return (
      <EmptyState
        icon={<BarChart3 className="size-8 text-muted-foreground/30" />}
        title="No projections available"
        description="No prior-season stats were found to build projections from. Sync historical player stats to enable them."
      />
    )
  }

  const Th = ({ label, k, align = 'right' }: { label: string; k?: SortKey; align?: 'left' | 'right' }) => (
    <th
      className={cn('px-2 py-2 text-[9px] font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer select-none whitespace-nowrap', align === 'right' && 'text-right')}
      onClick={k ? () => toggleSort(k) : undefined}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        {k && sortKey === k && (sortDesc ? <ChevronDown className="size-2.5" /> : <ChevronUp className="size-2.5" />)}
      </span>
    </th>
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-lg border border-border/40 bg-card/30 p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="size-4 text-primary" />
            <span className="text-sm font-semibold">{data.season} Draft Projections</span>
            <Tooltip content={
              <div className="space-y-1 text-[9px] leading-relaxed text-muted-foreground/80">
                <div className="text-[10px] font-semibold">How projections work</div>
                <div>Recent-season usage &amp; efficiency are weighted (most recent counts most)</div>
                <div>Regressed toward position baselines and adjusted for age</div>
                <div>Converted to fantasy points using your league's scoring rules</div>
                <div>Low confidence = little/no prior-season history (e.g. rookies)</div>
              </div>
            }>
              <TrendingUp className="size-3.5 text-muted-foreground/40 cursor-help" />
            </Tooltip>
          </div>
          <div className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{data.players.length}</span> players ·{' '}
            <span className="font-semibold text-foreground">{Math.round(totalPoints)}</span> total projected pts
          </div>
        </div>
      </div>

      {/* Position filter + per-position summary */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setPosition('ALL')}
          className={cn('text-xs font-semibold px-3 py-1 rounded-full border transition-all', position === 'ALL' ? 'bg-primary text-primary-foreground border-primary shadow-md' : 'text-muted-foreground hover:text-foreground border-border/40 bg-muted/20')}
        >
          All
        </button>
        {POSITIONS.map((pos) => {
          const st = positionStyles[pos] || defaultStyle
          const active = position === pos
          const count = playerCounts[pos] || 0
          const summary = totalsByPos[pos]
          return (
            <button
              key={pos}
              onClick={() => setPosition(active ? 'ALL' : pos)}
              className={cn('text-xs font-semibold px-3 py-1 rounded-full border transition-all flex items-center gap-1.5', active ? 'bg-primary text-primary-foreground border-primary shadow-md' : cn(st.bg, st.border, st.text, 'hover:opacity-80'))}
            >
              {pos}
              {summary && <span className={cn('text-[9px] font-normal opacity-70', active ? 'text-primary-foreground/70' : '')}>·{summary.top}</span>}
              {count > 0 && <span className={cn('text-[9px] font-normal opacity-50', active ? 'text-primary-foreground/70' : '')}>{count}</span>}
            </button>
          )
        })}
      </div>

      {/* Board */}
      <div className="rounded-lg border border-border/40 bg-card/30 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60">
                <Th label="#" k="overall_rank" align="left" />
                <Th label="Pos" />
                <Th label="Player" align="left" />
                <Th label="Pts" k="projected_points" />
                <Th label="Pos Rk" k="position_rank" />
                <Th label="Games" />
                <Th label="Conf" k="confidence" />
                <Th label="" />
              </tr>
            </thead>
            <tbody>
              {players.map((p) => {
                const st = positionStyles[p.position] || defaultStyle
                const conf = confidenceLabel(p.confidence)
                const isOpen = expanded.has(p.player_id)
                return (
                  <Fragment key={p.player_id}>
                    <tr className="border-b border-border/40 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => toggleExpand(p.player_id)}>
                      <td className="px-2 py-2 text-muted-foreground font-mono tabular-nums text-xs">{p.overall_rank}</td>
                      <td className="px-2 py-2">
                        <Badge variant="outline" className={cn('text-[8px] px-1.5 py-0 font-semibold', st.text, st.bg, 'border-current/30')}>{p.position}</Badge>
                      </td>
                      <td className="px-2 py-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate('/league/' + groupId + '/' + leagueId + '/player/' + p.player_id + (tabParam ? '?tab=' + tabParam : '')) }}
                          className="flex items-center gap-2 text-left group"
                        >
                          <div className="size-6 rounded-full bg-muted overflow-hidden ring-1 ring-border flex-shrink-0">
                            {p.player_img ? (
                              <img src={p.player_img} alt="" className="size-full object-cover" />
                            ) : (
                              <div className="size-full flex items-center justify-center text-[9px] font-bold text-muted-foreground">{p.name.charAt(0)}</div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-semibold group-hover:text-primary transition-colors truncate block">{p.name}</span>
                            <span className="flex items-center gap-1 text-[9px] text-muted-foreground/60">
                              {p.team_logo && <img src={p.team_logo} alt="" className="size-2.5 rounded-full object-contain" />}
                              {p.team || '—'}
                            </span>
                          </div>
                        </button>
                      </td>
                      <td className="px-2 py-2 text-right font-semibold tabular-nums text-xs">{p.projected_points.toFixed(1)}</td>
                      <td className="px-2 py-2 text-right text-muted-foreground tabular-nums text-xs">{p.position_rank}</td>
                      <td className="px-2 py-2 text-right text-muted-foreground tabular-nums text-xs">{p.games}</td>
                      <td className="px-2 py-2 text-right">
                        <span className={cn('text-[8px] font-bold px-1.5 py-0.5 rounded border', conf.cls)}>{conf.label}</span>
                      </td>
                      <td className="px-2 py-2 text-muted-foreground/40">
                        {isOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b border-border/40 bg-muted/10">
                        <td colSpan={8} className="px-4 py-3">
                          <ProjectionCard player={p} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function ProjectionCard({ player }: { player: ProjectionPlayer }) {
  const stats = Object.entries(player.statline || {})
  const isDef = player.position === 'DEF'
  return (
    <div className="flex flex-wrap gap-6 items-start text-xs">
      <div className="flex items-center gap-3">
        <div className="text-center">
          <div className="text-2xl font-bold tabular-nums">{player.projected_points.toFixed(0)}</div>
          <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Proj Pts</div>
        </div>
        <div className="h-10 w-px bg-border/40" />
        <div className="text-center">
          <div className="text-lg font-semibold tabular-nums">{player.games}</div>
          <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Games</div>
        </div>
      </div>

      {!isDef && stats.length > 0 && (
        <div className="flex-1 min-w-[200px]">
          <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Activity className="size-3" /> Projected Stat Line
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
            {stats.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground/60">{STAT_LABELS[k] || k}</span>
                <span className="font-semibold tabular-nums">{Math.round(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 min-w-[120px]">
        <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
          <TrendingUp className="size-3" /> Confidence
        </div>
        {(() => {
          const conf = confidenceLabel(player.confidence)
          return (
            <div className="space-y-1">
              <div className="h-1.5 rounded-full bg-muted/20 overflow-hidden">
                <div className={cn('h-full rounded-full', player.confidence >= 0.66 ? 'bg-emerald-500' : player.confidence >= 0.33 ? 'bg-amber-400' : 'bg-red-400')} style={{ width: `${Math.round(player.confidence * 100)}%` }} />
              </div>
              <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border', conf.cls)}>{conf.label}</span>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
