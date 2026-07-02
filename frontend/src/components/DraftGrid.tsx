import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Badge } from '../components/ui/badge'
import Tooltip from '../components/ui/tooltip'
import { cn } from '../lib/utils'
import { fetchPlayerStats } from '../lib/api'
import type { Roster, Draft, DraftPick, PlayerStats } from '../types'
import { Medal, Trophy, ArrowUp, ArrowDown, HelpCircle, BarChart3, SearchX } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell } from 'recharts'

interface Props {
  rosters: Roster[]
  drafts: Draft[]
  leagueId: string
}

const positionStyles: Record<string, { bg: string; border: string; text: string }> = {
  QB: { bg: 'bg-sky-500/15', border: 'border-sky-500/30', text: 'text-sky-300' },
  RB: { bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-300' },
  WR: { bg: 'bg-violet-500/15', border: 'border-violet-500/30', text: 'text-violet-300' },
  TE: { bg: 'bg-amber-500/15', border: 'border-amber-500/30', text: 'text-amber-300' },
  K:  { bg: 'bg-zinc-500/15', border: 'border-zinc-500/30', text: 'text-zinc-300' },
  DEF:{ bg: 'bg-red-500/15', border: 'border-red-500/30', text: 'text-red-300' },
}
const defaultStyle = { bg: 'bg-zinc-500/10', border: 'border-zinc-500/20', text: 'text-zinc-300' }

function gradeFor(pct: number | null): { grade: string; text: string; bg: string } {
  if (pct == null) return { grade: 'F', text: 'text-zinc-500/50', bg: 'bg-zinc-500/10' }
  if (pct > 70) return { grade: 'A+', text: 'text-emerald-400', bg: 'bg-emerald-500/20' }
  if (pct > 40) return { grade: 'A', text: 'text-emerald-400', bg: 'bg-emerald-500/15' }
  if (pct > 15) return { grade: 'B', text: 'text-emerald-300', bg: 'bg-emerald-500/10' }
  if (pct > -15) return { grade: 'C', text: 'text-zinc-400', bg: 'bg-zinc-500/10' }
  if (pct > -50) return { grade: 'D', text: 'text-red-300', bg: 'bg-red-500/10' }
  return { grade: 'F', text: 'text-red-400', bg: 'bg-red-500/20' }
}

export default function DraftGrid({ rosters, drafts, leagueId }: Props) {
  const navigate = useNavigate()
  const rosterMap = new Map(rosters.map((r) => [r.roster_id, r]))
  const [mode, setMode] = useState<'position' | 'value'>('position')
  const [rankMap, setRankMap] = useState<Map<string, { overall_rank: number; position_rank: number }>>(new Map())
  const [allPlayers, setAllPlayers] = useState<PlayerStats[]>([])
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: React.ReactNode } | null>(null)

  useEffect(() => {
    fetchPlayerStats(leagueId, { sort: 'total', brief: true, limit: 0 })
      .then((data) => {
        const m = new Map<string, { overall_rank: number; position_rank: number }>()
        for (const p of data.players || []) {
          if (p.overall_rank != null) {
            m.set(p.player_id, { overall_rank: p.overall_rank, position_rank: p.position_rank ?? 999 })
          }
        }
        setRankMap(m)
        setAllPlayers(data.players || [])
        
      })
      .catch(() => {})
  }, [leagueId])

  const showTooltip = useCallback((e: React.MouseEvent, content: React.ReactNode) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setTooltip({ x: rect.left + rect.width / 2, y: rect.top, content })
  }, [])

  const hideTooltip = useCallback(() => setTooltip(null), [])

  if (drafts.length === 0) {
    return <p className="text-muted-foreground text-sm text-center py-4">No draft data available.</p>
  }

  return (
    <div className="space-y-4">
      {drafts.map((d) => {
        const byRound: Map<number, Map<number, DraftPick>> = new Map()
        d.picks.forEach((p) => {
          if (p.roster_id == null) return
          if (!byRound.has(p.round)) byRound.set(p.round, new Map())
          byRound.get(p.round)!.set(p.roster_id, p)
        })

        const rounds = [...byRound.keys()].sort((a, b) => a - b)
        const firstRound = byRound.get(1)
        const order: { roster_id: number; pick_no: number }[] = []
        if (firstRound) {
          for (const [rid, pick] of firstRound) {
            order.push({ roster_id: rid, pick_no: pick.pick_no })
          }
        }
        order.sort((a, b) => a.pick_no - b.pick_no)
        const columnOrder = order.map((o) => o.roster_id)
        const columnWidth = 120

        // Compute expected positional rank from draft order
        const posOrder: Record<string, number> = {}
        const expectedRanks = new Map<string, number>()
        for (const round of rounds) {
          for (const rid of columnOrder) {
            const pick = byRound.get(round)?.get(rid)
            if (!pick || !pick.player_id || !pick.position) continue
            posOrder[pick.position] = (posOrder[pick.position] || 0) + 1
            expectedRanks.set(pick.player_id, posOrder[pick.position])
          }
        }

        // Compute value per pick for all teams
        const allPicksWithValue: { value: number; grade: string; player: string; team: string; roster_id: number; pick_no: number; round: number; player_id: string | null; roster_avatar: string | null; player_img: string | null; position: string; nfl_team: string | null; nfl_logo: string | null; expected: number; surplus: number; weight: number }[] = []
        const rosterValues = new Map<number, { avg: number; grade: string; picks: { grade: string; value: number; pick_no: number; round: number; player: string; expected: number; surplus: number; weight: number }[] }>()

        for (const rid of columnOrder) {
          const picks: { grade: string; value: number; pick_no: number; round: number; player: string; expected: number; surplus: number; weight: number }[] = []
          for (const round of rounds) {
            const pick = byRound.get(round)?.get(rid)
            if (!pick || !pick.player_id) continue
            const r = rosterMap.get(rid)
            const rank = rankMap.get(pick.player_id)
            const expected = pick.player_id ? expectedRanks.get(pick.player_id) ?? -999 : -999
            const surplus = rank ? expected - rank.position_rank : 0
            const weight = 1 / Math.sqrt(pick.pick_no)
            const value = rank ? Math.round(surplus * weight * 100) : -500
            const name = pick.first_name && pick.last_name ? `${pick.first_name} ${pick.last_name}` : pick.player_id || ''
            picks.push({ grade: '', value, pick_no: pick.pick_no, round: pick.round, player: name, expected: rank ? expected : -999, surplus: rank ? expected - rank.position_rank : -999, weight: weight })
            allPicksWithValue.push({
              value, grade: '', player: name, team: r?.team_name || `Team ${rid}`,
              roster_id: rid, pick_no: pick.pick_no, round: pick.round, player_id: pick.player_id,
              roster_avatar: r?.owner_avatar ?? null,
              player_img: pick.player_id && /^\d+$/.test(pick.player_id) ? `https://sleepercdn.com/content/nfl/players/${pick.player_id}.jpg` : null,
              position: pick.position || '',
              nfl_team: pick.team || null,
              nfl_logo: pick.team_logo || null,
              expected: rank ? expected : -999,
              surplus: rank ? expected - rank.position_rank : -999,
              weight: weight,
            })
          }
          // Weighted average: each pick weighted by 1/sqrt(pick_no)
          const totalWeight = picks.reduce((s, p) => s + 1 / Math.sqrt(p.pick_no), 0)
          const weightedSum = picks.reduce((s, p) => s + p.value * (1 / Math.sqrt(p.pick_no)), 0)
          const avg = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0
          rosterValues.set(rid, { avg, grade: '', picks })
        }

        // Grade individual picks by z-score relative to all picks in the draft
        const pickValues = allPicksWithValue.map(p => p.value)
        const pickValuesFiltered = pickValues.filter(v => v !== -500)
        const pickMean = pickValuesFiltered.length > 0 ? pickValuesFiltered.reduce((s, v) => s + v, 0) / pickValuesFiltered.length : 0
        const pickStd = pickValuesFiltered.length > 1 ? Math.sqrt(pickValuesFiltered.reduce((s, v) => s + (v - pickMean) ** 2, 0) / pickValuesFiltered.length) : 0

        function zGradeFor(value: number | null, mean: number, std: number): { grade: string; text: string; bg: string } {
          if (value == null) return { grade: 'F', text: 'text-zinc-500/50', bg: 'bg-zinc-500/10' }
          if (std === 0) return { grade: 'C', text: 'text-zinc-400', bg: 'bg-zinc-500/10' }
          const z = (value - mean) / std
          if (z > 1.0)  return { grade: 'A+', text: 'text-emerald-400', bg: 'bg-emerald-500/20' }
          if (z > 0.5)  return { grade: 'A',  text: 'text-emerald-400', bg: 'bg-emerald-500/15' }
          if (z > 0)    return { grade: 'B',  text: 'text-emerald-300', bg: 'bg-emerald-500/10' }
          if (z > -0.5) return { grade: 'C',  text: 'text-zinc-400',    bg: 'bg-zinc-500/10' }
          if (z > -1.0) return { grade: 'D',  text: 'text-red-300',     bg: 'bg-red-500/10' }
          return          { grade: 'F',  text: 'text-red-400',     bg: 'bg-red-500/20' }
        }

        function zColorFor(value: number, mean: number, std: number): string {
          if (std === 0) return 'bg-zinc-500/10 border-zinc-500/20'
          const z = (value - mean) / std
          if (z > 1.0)  return 'bg-emerald-500/40 border-emerald-500/40'
          if (z > 0.5)  return 'bg-emerald-500/25 border-emerald-500/25'
          if (z > 0)    return 'bg-emerald-500/12 border-emerald-500/12'
          if (z > -0.5) return 'bg-zinc-500/10 border-zinc-500/20'
          if (z > -1.0) return 'bg-red-500/12 border-red-500/12'
          return 'bg-red-500/30 border-red-500/30'
        }

        for (const p of allPicksWithValue) {
          p.grade = zGradeFor(p.value, pickMean, pickStd).grade
        }
        for (const [, roster] of rosterValues) {
          for (const p of roster.picks) {
            p.grade = zGradeFor(p.value, pickMean, pickStd).grade
          }
        }

        // Grade teams by z-score of their weighted average
        const teamAvgs = [...rosterValues.values()].map(v => v.avg)
        const teamMean = teamAvgs.length > 0 ? teamAvgs.reduce((s, v) => s + v, 0) / teamAvgs.length : 0
        const teamStd = teamAvgs.length > 1 ? Math.sqrt(teamAvgs.reduce((s, v) => s + (v - teamMean) ** 2, 0) / teamAvgs.length) : 0

        for (const v of rosterValues.values()) {
          v.grade = zGradeFor(v.avg, teamMean, teamStd).grade
        }

        const sortedRids = [...rosterValues.entries()].sort((a, b) => b[1].avg - a[1].avg).map(([rid]) => rid)
        const bestPicks = [...allPicksWithValue].sort((a, b) => b.value - a.value).slice(0, 12)
        const worstPicks = [...allPicksWithValue].sort((a, b) => a.value - b.value).slice(0, 12)

        return (
          <div key={d.draft_id} className="space-y-4">
            {/* Top section: Draft Standings + Best/Worst Picks */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Draft Standings */}
              <div className="rounded-lg border border-border/40 bg-card/30 p-3">
                <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Trophy className="size-3.5" />
                  Draft Standings
                    <Tooltip content={
                    <div className="space-y-1">
                      <div className="text-[10px] font-semibold">How grades are calculated</div>
                      <div className="text-[9px] leading-relaxed text-muted-foreground/80">
                        Each pick: score = (expected − actual) × 1/√(pick_no)
                      </div>
                      <div className="text-[9px] leading-relaxed text-muted-foreground/80">
                        Team score: weighted avg of all picks for that team
                      </div>
                      <div className="text-[9px] leading-relaxed text-muted-foreground/80 mt-1">
                        Grade = z-score of pick/team score vs the draft distribution
                      </div>
                      <div className="text-[9px] leading-relaxed text-muted-foreground/80 mt-0.5">
                        z &gt; 1.0 → A+ &nbsp; z &gt; 0.5 → A &nbsp; z &gt; 0 → B
                      </div>
                      <div className="text-[9px] leading-relaxed text-muted-foreground/80">
                        z &gt; −0.5 → C &nbsp; z &gt; −1.0 → D &nbsp; else → F
                      </div>
                    </div>
                  }>
                    <HelpCircle className="size-4 text-muted-foreground/40 cursor-help" />
                  </Tooltip>
                </div>
                <div className="flex items-center gap-2.5 px-2 pb-1.5 text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <div className="w-5 flex-shrink-0 text-center">#</div>
                  <div className="size-7 flex-shrink-0" />
                  <div className="flex-1 min-w-0">Team</div>
                  <div className="text-right flex-shrink-0 w-10 tabular-nums">z</div>
                  <div className="text-right flex-shrink-0 w-14">Grade</div>
                </div>
                {sortedRids.map((rid, idx) => {
                  const r = rosterMap.get(rid)
                  const data = rosterValues.get(rid)
                  if (!data) return null
                  const teamZ = teamStd > 0 ? ((data.avg - teamMean) / teamStd) : 0
                  return (
                    <div key={rid} className="flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-muted/20 transition-all duration-200">
                      <div className="w-5 flex-shrink-0 text-center">
                        {idx < 3 ? (
                          <Medal className={`size-3.5 ${['text-yellow-400', 'text-gray-400', 'text-amber-600'][idx]} mx-auto`} />
                        ) : (
                          <span className="text-[10px] text-muted-foreground">{idx + 1}</span>
                        )}
                      </div>
                      <div className="size-7 rounded-full bg-muted overflow-hidden flex-shrink-0 ring-1 ring-border">
                        {r?.owner_avatar ? (
                          <img src={r.owner_avatar} alt="" className="size-full object-cover" />
                        ) : (
                          <div className="size-full flex items-center justify-center text-[9px] font-bold text-muted-foreground">
                            {(r?.team_name || '?').charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-semibold truncate block">{r?.team_name || `Team ${rid}`}</span>
                      </div>
                      <div className={cn('text-right flex-shrink-0 w-10 tabular-nums text-[9px]', zGradeFor(data.avg, teamMean, teamStd).text)}>
                        {teamZ >= 0 ? '+' : ''}{teamZ.toFixed(2)}
                      </div>
                      <div className="text-right flex-shrink-0 w-14">
                        <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded', zGradeFor(data.avg, teamMean, teamStd).text, zGradeFor(data.avg, teamMean, teamStd).bg)}>{data.grade}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Best Picks */}
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                <div className="text-xs font-semibold text-emerald-400 mb-2 flex items-center gap-1.5">
                  <ArrowUp className="size-3.5" />
                  Best Picks
                </div>
                <div className="flex items-center gap-2.5 px-2 pb-1.5 text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <div className="w-14 flex-shrink-0">Pick</div>
                  <div className="flex-1 min-w-0">Player</div>
                  <div className="text-right flex-shrink-0 w-10">Gr</div>
                </div>
                <div className="space-y-0.5">
                  {bestPicks.slice(0, 12).map((p, i) => (
                    <button
                      key={`best-${i}`}
                      onClick={() => p.player_id && navigate(`/league/${leagueId}/player/${p.player_id}`)}
                      onMouseEnter={(e) => {
                        const result = p.surplus !== -999 && p.expected !== -999 ? p.expected - p.surplus : null
                        const z = pickStd > 0 ? (p.value - pickMean) / pickStd : 0
                        const g = zGradeFor(p.value, pickMean, pickStd)
                        const lines = [
                          { label: 'Expected', value: p.expected !== -999 ? `#${p.expected} ${p.position}` : '—', color: '' },
                          { label: 'Result', value: result != null ? `#${result} ${p.position}` : 'N/A', color: result != null ? g.text : 'text-muted-foreground/40' },
                          { label: 'z-score', value: `${z >= 0 ? '+' : ''}${z.toFixed(2)}`, color: g.text },
                        ]
                        showTooltip(e, (
                          <div className="text-[10px] leading-relaxed space-y-0.5">
                            {lines.map((l, li) => (
                              <div key={li} className="flex items-center justify-between gap-4">
                                <span className="text-muted-foreground/60">{l.label}</span>
                                <span className={cn('font-semibold tabular-nums whitespace-nowrap', l.color)}>{l.value}</span>
                              </div>
                            ))}
                          </div>
                        ))
                      }}
                      onMouseLeave={hideTooltip}
                      className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-emerald-500/10 transition-colors"
                    >
                      <span className="text-[9px] font-mono text-muted-foreground/60 w-14 tabular-nums flex-shrink-0">R{p.round}.{p.pick_no}</span>
                      <div className="size-5 rounded-full bg-muted overflow-hidden flex-shrink-0 ring-1 ring-border">
                        {p.player_img ? (
                          <img src={p.player_img} alt="" className="size-full object-cover" />
                        ) : (
                          <div className="size-full flex items-center justify-center text-[7px] font-bold text-muted-foreground">{p.player.charAt(0)}</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] font-semibold truncate">{p.player}</span>
                          {p.position && <span className={cn('text-[8px] font-semibold px-1 py-0 h-3 leading-none rounded border border-current/30', positionStyles[p.position]?.text || defaultStyle.text, positionStyles[p.position]?.bg || defaultStyle.bg)}>{p.position}</span>}
                          {p.nfl_logo && <img src={p.nfl_logo} alt="" className="size-3 rounded-full object-contain flex-shrink-0" />}
                          {p.nfl_team && <span className="text-[8px] font-mono text-muted-foreground/40">{p.nfl_team}</span>}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          {p.roster_avatar && <img src={p.roster_avatar} alt="" className="size-3 rounded-full ring-1 ring-border" />}
                          <span className="text-[9px] text-muted-foreground/60 truncate">{p.team}</span>
                        </div>
                      </div>
                      <span className={cn('text-[8px] font-bold px-1.5 py-0.5 rounded flex-shrink-0', zGradeFor(p.value, pickMean, pickStd).text, zGradeFor(p.value, pickMean, pickStd).bg)}>{p.grade}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Worst Picks */}
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                <div className="text-xs font-semibold text-red-400 mb-2 flex items-center gap-1.5">
                  <ArrowDown className="size-3.5" />
                  Worst Picks
                </div>
                <div className="flex items-center gap-2.5 px-2 pb-1.5 text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <div className="w-14 flex-shrink-0">Pick</div>
                  <div className="flex-1 min-w-0">Player</div>
                  <div className="text-right flex-shrink-0 w-10">Gr</div>
                </div>
                <div className="space-y-0.5">
                  {worstPicks.slice(0, 12).map((p, i) => (
                    <button
                      key={`worst-${i}`}
                      onClick={() => p.player_id && navigate(`/league/${leagueId}/player/${p.player_id}`)}
                      onMouseEnter={(e) => {
                        const result = p.surplus !== -999 && p.expected !== -999 ? p.expected - p.surplus : null
                        const z = pickStd > 0 ? (p.value - pickMean) / pickStd : 0
                        const g = zGradeFor(p.value, pickMean, pickStd)
                        const lines = [
                          { label: 'Expected', value: p.expected !== -999 ? `#${p.expected} ${p.position}` : '—', color: '' },
                          { label: 'Result', value: result != null ? `#${result} ${p.position}` : 'N/A', color: result != null ? g.text : 'text-muted-foreground/40' },
                          { label: 'z-score', value: `${z >= 0 ? '+' : ''}${z.toFixed(2)}`, color: g.text },
                        ]
                        showTooltip(e, (
                          <div className="text-[10px] leading-relaxed space-y-0.5">
                            {lines.map((l, li) => (
                              <div key={li} className="flex items-center justify-between gap-4">
                                <span className="text-muted-foreground/60">{l.label}</span>
                                <span className={cn('font-semibold tabular-nums whitespace-nowrap', l.color)}>{l.value}</span>
                              </div>
                            ))}
                          </div>
                        ))
                      }}
                      onMouseLeave={hideTooltip}
                      className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-red-500/10 transition-colors"
                    >
                      <span className="text-[9px] font-mono text-muted-foreground/60 w-14 tabular-nums flex-shrink-0">R{p.round}.{p.pick_no}</span>
                      <div className="size-5 rounded-full bg-muted overflow-hidden flex-shrink-0 ring-1 ring-border">
                        {p.player_img ? (
                          <img src={p.player_img} alt="" className="size-full object-cover" />
                        ) : (
                          <div className="size-full flex items-center justify-center text-[7px] font-bold text-muted-foreground">{p.player.charAt(0)}</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] font-semibold truncate">{p.player}</span>
                          {p.position && <span className={cn('text-[8px] font-semibold px-1 py-0 h-3 leading-none rounded border border-current/30', positionStyles[p.position]?.text || defaultStyle.text, positionStyles[p.position]?.bg || defaultStyle.bg)}>{p.position}</span>}
                          {p.nfl_logo && <img src={p.nfl_logo} alt="" className="size-3 rounded-full object-contain flex-shrink-0" />}
                          {p.nfl_team && <span className="text-[8px] font-mono text-muted-foreground/40">{p.nfl_team}</span>}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          {p.roster_avatar && <img src={p.roster_avatar} alt="" className="size-3 rounded-full ring-1 ring-border" />}
                          <span className="text-[9px] text-muted-foreground/60 truncate">{p.team}</span>
                        </div>
                      </div>
                      <span className={cn('text-[8px] font-bold px-1.5 py-0.5 rounded flex-shrink-0', zGradeFor(p.value, pickMean, pickStd).text, zGradeFor(p.value, pickMean, pickStd).bg)}>{p.grade}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom section: Distribution + Missed Picks */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Distribution Histogram */}
              <div className="rounded-lg border border-border/40 bg-card/30 p-3">
                <div className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
                  <BarChart3 className="size-3.5" />
                  Score Distribution
                </div>
                {(() => {
                  const binSize = 200
                  const vals = allPicksWithValue.map(p => p.value)
                  const mn = Math.min(...vals)
                  const mx = Math.max(...vals)
                  const lo = Math.floor(mn / binSize) * binSize
                  const hi = Math.ceil(mx / binSize) * binSize
                  const binCount = Math.ceil((hi - lo) / binSize)
                  const bins = Array.from({ length: binCount }, (_, i) => {
                    const l = lo + i * binSize
                    const count = allPicksWithValue.filter(p =>
                      i === binCount - 1 ? p.value >= l && p.value <= l + binSize : p.value >= l && p.value < l + binSize
                    ).length
                    return { range: `${l}`, count, isPositive: l >= 0 }
                  })
                  return (
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={bins} margin={{ top: 0, right: 0, bottom: 0, left: -12 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis
                          dataKey="range"
                          tick={{ fontSize: 8, fill: 'var(--muted-foreground)', fillOpacity: 0.6 }}
                          axisLine={{ stroke: 'hsl(var(--border))' }}
                          tickLine={false}
                          interval={1}
                        />
                        <YAxis
                          tick={{ fontSize: 9, fill: 'var(--muted-foreground)', fillOpacity: 0.6 }}
                          axisLine={false}
                          tickLine={false}
                          allowDecimals={false}
                        />
                        <Bar dataKey="count" radius={[2, 2, 0, 0]} maxBarSize={24}>
                          {bins.map((bin, idx) => (
                            <Cell
                              key={idx}
                              fill={bin.count === 0 ? '#a1a1aa' : bin.isPositive ? '#22c55e' : '#ef4444'}
                              fillOpacity={bin.count === 0 ? 0.3 : 0.55}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )
                })()}
                <div className="flex items-center justify-center gap-3 mt-2 text-[9px] text-muted-foreground/60">
                  <span className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-red-500/60" /> Underperformed</span>
                  <span className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-zinc-400/30" /> No picks</span>
                  <span className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-emerald-500/60" /> Beat expectations</span>
                </div>
              </div>

              {/* Missed Picks — Undrafted Gems */}
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                <div className="text-xs font-semibold text-amber-400 mb-2 flex items-center gap-1.5">
                  <SearchX className="size-3.5" />
                  Missed Picks
                </div>
                {(() => {
                  const draftedIds = new Set(d.picks.map(p => p.player_id).filter(Boolean) as string[])
                  const undrafted = allPlayers
                    .filter(p => p.overall_rank != null && p.position_rank != null && !draftedIds.has(p.player_id))
                    .sort((a, b) => (b.total_points || 0) - (a.total_points || 0))
                    .slice(0, 5)
                  if (undrafted.length === 0) {
                    return <p className="text-[10px] text-muted-foreground/60 text-center py-6">No undrafted gems found.</p>
                  }
                  return (
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 px-2 pb-1 text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
                        <div className="flex-1 min-w-0">Player</div>
                        <div className="text-right flex-shrink-0 w-12">Pts</div>
                        <div className="text-right flex-shrink-0 w-8">OvRk</div>
                        <div className="text-right flex-shrink-0 w-8">PosRk</div>
                      </div>
                      {undrafted.map((p) => (
                        <button
                          key={p.player_id}
                          onClick={() => navigate(`/league/${leagueId}/player/${p.player_id}`)}
                          className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-amber-500/10 transition-colors"
                        >
                          <div className="size-5 rounded-full bg-muted overflow-hidden flex-shrink-0 ring-1 ring-border">
                            {p.player_img ? (
                              <img src={p.player_img} alt="" className="size-full object-cover" />
                            ) : (
                              <div className="size-full flex items-center justify-center text-[7px] font-bold text-muted-foreground">{p.name.charAt(0)}</div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <span className="text-[11px] font-semibold truncate">{p.name}</span>
                              {p.position && <span className={cn('text-[8px] font-semibold px-1 py-0 h-3 leading-none rounded border border-current/30', positionStyles[p.position]?.text || defaultStyle.text, positionStyles[p.position]?.bg || defaultStyle.bg)}>{p.position}</span>}
                              {p.team_logo && <img src={p.team_logo} alt="" className="size-3 rounded-full object-contain flex-shrink-0" />}
                              {p.team && <span className="text-[8px] font-mono text-muted-foreground/40">{p.team}</span>}
                            </div>
                          </div>
                          <span className="text-[9px] font-mono tabular-nums text-foreground/80 flex-shrink-0 w-12 text-right">{Math.round(p.total_points)}</span>
                          <span className="text-[8px] font-mono tabular-nums text-muted-foreground/50 flex-shrink-0 w-8 text-right">#{p.overall_rank}</span>
                          <span className="text-[8px] font-mono tabular-nums text-muted-foreground/50 flex-shrink-0 w-8 text-right">#{p.position_rank}</span>
                        </button>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </div>

            {/* Header bar */}
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-muted-foreground">{d.season} Draft · {d.type} · {d.picks.length} picks · {rounds.length} rounds</div>
              <div className="flex items-center gap-2">
                <Tooltip content={
                  <div className="space-y-1">
                    <div className="text-[10px] font-semibold">Value Mode</div>
                    <div className="text-[9px] leading-relaxed text-muted-foreground/80">
                      Raw score = (expected − actual) × 1/√(pick_no)
                    </div>
                    <div className="text-[9px] leading-relaxed text-muted-foreground/80">
                      Displayed = round(raw × 100)
                    </div>
                    <div className="text-[9px] leading-relaxed text-muted-foreground/80">
                      Positive = beat expectations &nbsp; Negative = underperformed
                    </div>
                    <div className="text-[9px] leading-relaxed text-muted-foreground/80">
                      1/√(pick_no) — early picks judged more harshly
                    </div>
                    <div className="text-[9px] leading-relaxed text-muted-foreground/80 mt-1 pt-1 border-t border-border/20">
                      Grades assigned by z-score relative to the draft pool
                    </div>
                  </div>
                }>
                  <HelpCircle className="size-4 text-muted-foreground/30 cursor-help" />
                </Tooltip>
                <div className="flex gap-1 bg-muted/20 rounded-xl p-1 border border-border/40 shadow-sm">
                  <button
                    onClick={() => setMode('position')}
                    className={cn('text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-all', mode === 'position' ? 'bg-primary text-primary-foreground shadow-md scale-105' : 'text-muted-foreground hover:text-foreground')}
                  >
                    Position
                  </button>
                  <button
                    onClick={() => setMode('value')}
                    className={cn('text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-all', mode === 'value' ? 'bg-primary text-primary-foreground shadow-md scale-105' : 'text-muted-foreground hover:text-foreground')}
                  >
                    Value
                  </button>
                </div>
              </div>
            </div>

            {/* Draft board */}
            <div className="overflow-x-auto rounded-md border border-border">
              <div className="grid" style={{ gridTemplateColumns: `repeat(${columnOrder.length}, ${columnWidth}px)` }}>
                {columnOrder.map((rid) => {
                  const r = rosterMap.get(rid)
                  return (
                    <div key={rid} className="border-b border-r border-border p-1.5 flex flex-col items-center gap-1 bg-muted/20">
                      <div className="size-6 rounded-full bg-muted overflow-hidden ring-1 ring-border flex-shrink-0">
                        {r?.owner_avatar ? (
                          <img src={r.owner_avatar} alt="" className="size-full object-cover" />
                        ) : (
                          <div className="size-full flex items-center justify-center text-[9px] font-bold text-muted-foreground">
                            {(r?.team_name || '?').charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] font-medium leading-tight text-center truncate w-full">{r?.team_name || `Team ${rid}`}</span>
                    </div>
                  )
                })}

                {rounds.map((round) =>
                  columnOrder.map((rid) => {
                    const pick = byRound.get(round)?.get(rid)
                    if (!pick) {
                      return <div key={`${round}-${rid}`} className="border-b border-r border-border bg-muted/5" />
                    }
                    const pos = pick.position || ''
                    const posStyle = positionStyles[pos] || defaultStyle
                    const rank = pick.player_id ? rankMap.get(pick.player_id) : undefined
                    const expected = pick.player_id ? expectedRanks.get(pick.player_id) ?? -999 : -999
                    const surplus = rank ? expected - rank.position_rank : 0
                    const weight = 1 / Math.sqrt(pick.pick_no)
                    const value = rank ? Math.round(surplus * weight * 100) : null
                    const g = value != null ? zGradeFor(value, pickMean, pickStd) : gradeFor(null)

                    if (mode === 'position') {
                      return (
                        <button
                          key={`${round}-${rid}`}
                          onClick={() => pick.player_id && navigate(`/league/${leagueId}/player/${pick.player_id}`)}
                          className={`text-left border-b border-r border-border p-1.5 flex flex-col gap-0.5 transition-colors ${posStyle.bg} ${posStyle.border}`}
                        >
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] text-muted-foreground font-mono">R{pick.round}.{pick.pick_no}</span>
                            <div className="flex items-center gap-0.5 ml-auto">
                              {pick.team_logo && <img src={pick.team_logo} alt="" className="size-3" loading="lazy" />}
                              {pick.team && <span className="text-[8px] font-mono text-muted-foreground/40">{pick.team}</span>}
                            </div>
                          </div>
                          <span className={`text-[11px] font-semibold leading-tight truncate ${posStyle.text}`}>
                            {pick.first_name && pick.last_name ? `${pick.first_name} ${pick.last_name}` : pick.player_id || '-'}
                          </span>
                          <div className="flex items-center mt-0.5">
                            {pos && <Badge variant="outline" className={`text-[8px] px-1 py-0 h-3.5 leading-none font-semibold ${posStyle.text} ${posStyle.bg} border-current/30`}>{pos}</Badge>}
                          </div>
                        </button>
                      )
                    }

                    return (
                      <button
                        key={`${round}-${rid}`}
                        onClick={() => pick.player_id && navigate(`/league/${leagueId}/player/${pick.player_id}`)}
                        onMouseEnter={(e) => {
                          const g2 = value != null ? zGradeFor(value, pickMean, pickStd) : gradeFor(null)
                          const expected = pick.player_id ? expectedRanks.get(pick.player_id) ?? -999 : -999
                          const z = rank && pickStd > 0 ? ((value!) - pickMean) / pickStd : 0
                          const lines = [
                            { label: 'Player', value: `${pick.first_name} ${pick.last_name}`, color: '' },
                            { label: 'Drafted', value: `#${pick.pick_no} Overall`, color: '' },
                            { label: 'Expected', value: rank ? `#${expected} ${pick.position}` : '—', color: '' },
                            { label: 'Result', value: rank ? `#${rank.position_rank} ${pick.position} (Overall: #${rank.overall_rank})` : 'N/A (never played)', color: rank ? g2.text : 'text-muted-foreground/40' },
                            { label: 'z-score', value: rank ? `${z >= 0 ? '+' : ''}${z.toFixed(2)}` : '—', color: rank ? g2.text : 'text-muted-foreground/40' },
                            { label: 'Grade', value: g2.grade, color: g2.text },
                          ]
                          showTooltip(e, (
                            <div className="text-[10px] leading-relaxed space-y-0.5">
                              {lines.map((l, li) => (
                                <div key={li} className="flex items-center justify-between gap-4">
                                  <span className="text-muted-foreground/60">{l.label}</span>
                                  <span className={cn('font-semibold tabular-nums whitespace-nowrap', l.color)}>{l.value}</span>
                                </div>
                              ))}
                            </div>
                          ))
                        }}
                        onMouseLeave={hideTooltip}
                        className={`text-left border-b border-r border-border p-1.5 flex flex-col gap-0.5 transition-colors ${zColorFor(value ?? -999, pickMean, pickStd)}`}
                      >
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] text-muted-foreground font-mono">R{pick.round}.{pick.pick_no}</span>
                          <div className="flex items-center gap-0.5 ml-auto">
                            {pick.team_logo && <img src={pick.team_logo} alt="" className="size-3" loading="lazy" />}
                            {pick.team && <span className="text-[8px] font-mono text-muted-foreground/40">{pick.team}</span>}
                          </div>
                        </div>
                        <span className="text-[11px] font-semibold leading-tight truncate text-foreground/90">
                          {pick.first_name && pick.last_name ? `${pick.first_name} ${pick.last_name}` : pick.player_id || '-'}
                        </span>
                        <div className="flex items-center justify-between mt-0.5">
                          <div className="flex items-center gap-1">
                            {pos && <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 leading-none font-semibold text-muted-foreground/60 border-border/40 bg-muted/30">{pos}</Badge>}
                          </div>
                          <span className={cn('text-[8px] font-bold px-1 py-0 h-3.5 leading-none rounded flex items-center', g.text, g.bg)}>{g.grade}</span>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        )
      })}
      {tooltip && createPortal(
        <div
          className="pointer-events-none z-[9999] fixed"
          style={{ left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, -100%)' }}
        >
          <div className="px-3 py-2 rounded-lg shadow-xl border border-border/40 bg-popover text-popover-foreground min-w-[180px]">
            {tooltip.content}
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 -mt-px rotate-45 bg-popover border-r border-b border-border/40" />
        </div>,
        document.body
      )}
    </div>
  )
}
