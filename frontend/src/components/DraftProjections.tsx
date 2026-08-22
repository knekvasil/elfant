import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart3, TrendingUp, Activity, ChevronDown, ChevronUp, Search } from 'lucide-react'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import Tooltip from './ui/tooltip'
import EmptyState from './ui/empty-state'
import { cn } from '../lib/utils'
import { positionStyle, confidenceBadge, sosBadge } from '../lib/theme'
import { fetchProjections } from '../lib/api'
import type { ProjectionPlayer, ProjectionResponse } from '../types'

interface Props {
  leagueId: string
  groupId: string
  tabParam?: string | null
}

const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'] as const

const PAGE_SIZE = 50

function getPageList(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = new Set<number>([1, total, current - 1, current, current + 1])
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)
  const out: (number | null)[] = []
  let prev = 0
  for (const p of sorted) {
    if (p - prev > 1) out.push(null)
    out.push(p)
    prev = p
  }
  return out
}

type SortKey = 'projected_points' | 'overall_rank' | 'position_rank' | 'confidence' | 'sos_factor' | 'name'

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
  const label = c >= 0.66 ? 'High' : c >= 0.33 ? 'Med' : 'Low'
  return { label, cls: confidenceBadge(c) }
}

function sosLabel(f: number): { label: string; cls: string } {
  const pct = Math.round((f - 1) * 100)
  if (Math.abs(pct) < 1) return { label: '—', cls: 'text-muted-foreground/50' }
  return { label: `${pct > 0 ? '+' : ''}${pct}%`, cls: sosBadge(f) }
}

function kindBadge(kind: string): { label: string; cls: string } {
  if (kind === 'rookie') return { label: 'Rookie', cls: 'text-amber-700 bg-amber-500/15 border-amber-500/30 dark:text-amber-300 dark:bg-amber-500/10' }
  if (kind === 'unknown') return { label: 'No Data', cls: 'text-zinc-700 bg-zinc-500/15 border-zinc-500/30 dark:text-zinc-300 dark:bg-zinc-500/10' }
  return { label: '', cls: '' }
}

function FpgSparkline({ history }: { history: { season: number; fpg: number }[] }) {
  const vals = history.map((h) => h.fpg)
  if (vals.length < 2) return null
  const max = Math.max(...vals)
  const min = Math.min(...vals)
  const range = max - min || 1
  const W = 110
  const H = 34
  const PAD = 3
  const pts = vals
    .map((v, i) => {
      const x = PAD + (i / (vals.length - 1)) * (W - 2 * PAD)
      const y = H - PAD - ((v - min) / range) * (H - 2 * PAD)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  const area = `M${PAD},${H - PAD} L${pts.replace(/ /g, ' L')} L${W - PAD},${H - PAD} Z`
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible text-primary/70">
      <polygon points={area} fill="currentColor" opacity={0.08} />
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

export default function DraftProjections({ leagueId, groupId, tabParam }: Props) {
  const navigate = useNavigate()
  const [data, setData] = useState<ProjectionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [position, setPosition] = useState<string>('ALL')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('projected_points')
  const [sortDesc, setSortDesc] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)

  // Reset to the first page whenever the filtered/sorted set changes.
  useEffect(() => {
    setPage(1)
  }, [position, sortKey, sortDesc, search])

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
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter((p) => p.name.toLowerCase().includes(q) || (p.team || '').toLowerCase().includes(q))
    }
    const dir = sortDesc ? -1 : 1
    return [...list].sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name) * dir
      const av = a[sortKey] ?? 0
      const bv = b[sortKey] ?? 0
      if (av === bv) return 0
      return (av > bv ? 1 : -1) * dir
    })
  }, [data, position, search, sortKey, sortDesc])

  const pageCount = Math.max(1, Math.ceil(players.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pagePlayers = players.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

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
                <div>Regressed toward position baselines derived from this league&apos;s own data and adjusted for age</div>
                <div>Converted to fantasy points using your league&apos;s scoring rules</div>
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

        {/* Search */}
        <div className="relative mt-3 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search players..."
            className="w-full rounded-md border border-border/40 bg-muted/20 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-primary/50 focus:bg-muted/30 transition-colors"
          />
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
          const st = positionStyle(pos)
          const active = position === pos
          const count = playerCounts[pos] || 0
          const summary = totalsByPos[pos]
          const ctx = data.position_ctx?.[pos]
          return (
            <button
              key={pos}
              onClick={() => setPosition(active ? 'ALL' : pos)}
              className={cn('text-xs font-semibold px-3 py-1 rounded-full border transition-all flex items-center gap-1.5', active ? 'bg-primary text-primary-foreground border-primary shadow-md' : cn(st.bg, st.border, st.text, 'hover:opacity-80'))}
              title={ctx ? `Start ${ctx.starters} · replacement ${ctx.replacement}` : undefined}
            >
              {pos}
              {summary && <span className={cn('text-[9px] font-normal opacity-70', active ? 'text-primary-foreground/70' : '')}>top {summary.top}</span>}
              {ctx && <span className={cn('text-[9px] font-normal opacity-50', active ? 'text-primary-foreground/70' : '')}>start {ctx.starters}</span>}
              {count > 0 && <span className={cn('text-[9px] font-normal opacity-50', active ? 'text-primary-foreground/70' : '')}>{count}</span>}
            </button>
          )
        })}
      </div>

      {/* Board */}
      <div className="rounded-lg border border-border/40 bg-card/30 overflow-hidden">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur">
              <tr className="border-b border-border/60">
                <Th label="#" k="overall_rank" align="left" />
                <Th label="Pos" />
                <Th label="Player" align="left" />
                <Th label="Pts" k="projected_points" />
                <Th label="SoS" k="sos_factor" />
                <Th label="Pos Rk" k="position_rank" />
                <Th label="Games" />
                <Th label="Conf" k="confidence" />
                <Th label="" />
              </tr>
            </thead>
            <tbody>
              {pagePlayers.map((p) => {
                const st = positionStyle(p.position)
                const conf = confidenceLabel(p.confidence)
                const kb = kindBadge(p.kind)
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
                            {p.position === 'DEF' && p.team_logo ? (
                              <img src={p.team_logo} alt="" className="size-full object-contain" />
                            ) : p.player_img ? (
                              <img src={p.player_img} alt="" className="size-full object-cover" />
                            ) : (
                              <div className="size-full flex items-center justify-center text-[9px] font-bold text-muted-foreground">{p.name.charAt(0)}</div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold group-hover:text-primary transition-colors truncate block">{p.name}</span>
                              {kb.label && <span className={cn('text-[7px] font-bold px-1 py-px rounded border uppercase tracking-wide', kb.cls)}>{kb.label}</span>}
                            </span>
                            <span className="flex items-center gap-1 text-[9px] text-muted-foreground/60">
                              {p.position !== 'DEF' && p.team_logo && <img src={p.team_logo} alt="" className="size-2.5 rounded-full object-contain" />}
                              {p.team || '—'}
                              {p.draft_round != null && <span className="ml-0.5">R{p.draft_round}</span>}
                            </span>
                          </div>
                        </button>
                      </td>
                      <td className="px-2 py-2 text-right font-semibold tabular-nums text-xs">{p.projected_points.toFixed(1)}</td>
                      <td className="px-2 py-2 text-right">
                        <span className={cn('text-[8px] font-bold px-1.5 py-0.5 rounded border tabular-nums', sosLabel(p.sos_factor).cls)}>{sosLabel(p.sos_factor).label}</span>
                      </td>
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
                        <td colSpan={9} className="px-4 py-3">
                          <ProjectionCard player={p} replacement={data.position_ctx?.[p.position]?.replacement} />
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

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[10px] text-muted-foreground/60 tabular-nums">
            {players.length} player{players.length !== 1 ? 's' : ''} · page {currentPage} of {pageCount}
          </span>
          <div className="flex flex-wrap items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
            >
              Prev
            </Button>
            {getPageList(currentPage, pageCount).map((p, i) =>
              p === null ? (
                <span key={`gap-${i}`} className="text-[10px] text-muted-foreground/40 px-1 select-none">…</span>
              ) : (
                <Button
                  key={p}
                  variant={p === currentPage ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setPage(p)}
                  className="min-w-8"
                >
                  {p}
                </Button>
              )
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= pageCount}
              onClick={() => setPage(currentPage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function ProjectionCard({ player, replacement }: { player: ProjectionPlayer; replacement?: number }) {
  const stats = Object.entries(player.statline || {})
  const isDef = player.position === 'DEF'
  const vor = replacement != null ? player.projected_points - replacement : null
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
        {player.is_rookie && (
          <>
            <div className="h-10 w-px bg-border/40" />
            <div className="text-center">
              <div className="text-sm font-semibold tabular-nums text-muted-foreground">{player.range_low.toFixed(0)}–{player.range_high.toFixed(0)}</div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-wider">20th–80th %ile</div>
            </div>
          </>
        )}
        {vor != null && (
          <>
            <div className="h-10 w-px bg-border/40" />
            <div className="text-center">
              <div className={cn('text-lg font-semibold tabular-nums', vor >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                {vor >= 0 ? '+' : ''}{vor.toFixed(0)}
              </div>
              <div className="text-[9px] text-muted-foreground uppercase tracking-wider">vs Replacement</div>
            </div>
          </>
        )}
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
          <BarChart3 className="size-3" /> Schedule
        </div>
        {(() => {
          const sos = sosLabel(player.sos_factor)
          const hasAdj = Math.abs(player.sos_factor - 1) > 0.005
          return (
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground/60">Base</span>
                <span className="font-semibold tabular-nums">{player.base_points.toFixed(1)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground/60">Adj</span>
                <span className="font-semibold tabular-nums">{player.projected_points.toFixed(1)}</span>
              </div>
              <span className={cn('inline-block text-[9px] font-bold px-1.5 py-0.5 rounded border', sos.cls)}>
                {hasAdj ? `${sos.label} schedule` : 'Neutral schedule'}
              </span>
            </div>
          )
        })()}
      </div>

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

      {player.fpg_history.length > 0 && (
        <div className="flex-1 min-w-[120px]">
          <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
            <TrendingUp className="size-3" /> FP/g Trend
          </div>
          <div className="flex items-center gap-2">
            <FpgSparkline history={player.fpg_history} />
            <div className="space-y-0.5">
              {player.fpg_history.slice(-3).map((h) => (
                <div key={h.season} className="text-[9px] text-muted-foreground/60 tabular-nums">
                  {h.season} <span className="font-semibold text-foreground/80">{h.fpg}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}