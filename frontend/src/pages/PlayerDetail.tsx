import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, UserCheck, UserX, TrendingUp, Calendar, BarChart3, Gauge, LineChart, HeartPulse } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Skeleton } from '../components/ui/skeleton'
import PlayerHeatGrid from '../components/PlayerHeatGrid'
import PlayerLineChart from '../components/PlayerLineChart'
import UsagePie from '../components/UsagePie'
import VolatilityChart from '../components/VolatilityChart'
import { fetchPlayerCareer, fetchPlayerStats, fetchPlayerSchedule, fetchLeague } from '../lib/api'
import type { PlayerScheduleResponse } from '../lib/api'
import { cn } from '../lib/utils'
import type { PlayerCareerResponse, PlayerStats } from '../types'

const posColors: Record<string, string> = {
  QB: 'text-sky-300 border-sky-500/30 bg-sky-500/10',
  RB: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10',
  WR: 'text-amber-300 border-amber-500/30 bg-amber-500/10',
  TE: 'text-orange-300 border-orange-500/30 bg-orange-500/10',
  DEF: 'text-zinc-300 border-zinc-500/30 bg-zinc-500/10',
  K: 'text-red-300 border-red-500/30 bg-red-500/10',
}

function rankColor(rank: number): string {
  if (rank <= 50) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
  if (rank <= 300) return 'bg-amber-500/20 text-amber-300 border-amber-500/30'
  return 'bg-red-500/20 text-red-300 border-red-500/30'
}

function posRankColor(rank: number): string {
  if (rank <= 3) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
  if (rank <= 15) return 'bg-amber-500/20 text-amber-300 border-amber-500/30'
  return 'bg-red-500/20 text-red-300 border-red-500/30'
}

function HealthBar({ label, played, total }: { label: string; played: number; total: number }) {
  const pct = total > 0 ? Math.round((played / total) * 100) : 0
  return (
    <div className="flex items-center gap-2 text-[10px]">
      <span className="w-10 text-muted-foreground font-medium">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-muted/30 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', pct >= 85 ? 'bg-emerald-500/50' : pct >= 65 ? 'bg-amber-500/50' : 'bg-red-500/50')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn('w-12 text-right font-semibold tabular-nums', pct >= 85 ? 'text-emerald-400' : pct >= 65 ? 'text-amber-400' : 'text-red-400')}>
        {played}/{total}
      </span>
    </div>
  )
}

function UsageStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[10px] font-medium text-muted-foreground/60">{label}</span>
      <span className="text-base font-bold tabular-nums">{value}</span>
    </div>
  )
}

export default function PlayerDetail() {
  const { leagueId, playerId } = useParams<{ leagueId: string; playerId: string }>()
  const [career, setCareer] = useState<PlayerCareerResponse | null>(null)
  const [seasonStats, setSeasonStats] = useState<PlayerStats | null>(null)
  const [schedule, setSchedule] = useState<PlayerScheduleResponse | null>(null)
  const [leagueName, setLeagueName] = useState('')
  const [loading, setLoading] = useState(true)
  const [focusedSeason, setFocusedSeason] = useState<number | null>(null)
  const [showAllSeasons, setShowAllSeasons] = useState(false)

  useEffect(() => {
    if (!leagueId || !playerId) return
    setLoading(true)
    Promise.all([
      fetchPlayerCareer(leagueId, playerId),
      fetchPlayerStats(leagueId, { player_id: playerId, sort: 'total' }),
      fetchLeague(leagueId).then((d) => setLeagueName(d.league.name)).catch(() => {}),
      fetchPlayerSchedule(playerId).then(setSchedule).catch(() => {}),
    ])
      .then(([c, s]) => {
        setCareer(c)
        if (s.players?.length > 0) setSeasonStats(s.players[0])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [leagueId, playerId])

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-4 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (!career) {
    return (
      <div className="max-w-6xl mx-auto p-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">Player not found</p>
            <Link to={`/league/${leagueId}`} className="text-sm text-primary hover:underline mt-2 inline-block">Back to league</Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const p = career
  const cs = seasonStats
  const currentSeason = p.seasons[0]
  const allGames = p.seasons.reduce((s, x) => s + x.games, 0)
  const allPossible = p.seasons.reduce((s, x) => s + x.games_possible, 0)
  const allPoints = p.seasons.reduce((s, x) => s + x.total_points, 0)
  const careerAvg = allGames > 0 ? (allPoints / allGames).toFixed(1) : '0'
  const team = currentSeason?.team || cs?.team

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <Link to={`/league/${leagueId}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="size-3" />
        {leagueName || 'League'}
      </Link>

      {/* Row 1: Player card + Rank cards */}
      <div className="grid grid-cols-5 gap-4">
        <Card className="col-span-3">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <div className="size-14 rounded-full bg-muted overflow-hidden flex-shrink-0 ring-2 ring-border">
                {p.position === 'DEF' && cs?.team_logo ? (
                  <img src={cs.team_logo} alt="" className="size-full object-contain p-1" />
                ) : p.player_img ? (
                  <img src={p.player_img} alt="" className="size-full object-cover" loading="lazy" />
                ) : (
                  <div className="size-full flex items-center justify-center text-lg font-bold text-muted-foreground">
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold truncate">{p.name}</h1>
                  <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 h-4 font-semibold', posColors[p.position] || '')}>{p.position}</Badge>
                  {team && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-medium flex items-center gap-1">
                      {(cs?.team_logo || schedule?.team_logo) && <img src={cs?.team_logo || schedule?.team_logo} alt="" className="size-3 rounded-full object-contain" />}
                      {team}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  {cs?.status && cs.status !== 'Active' && <span className="text-amber-400 font-medium">{cs.status}</span>}
                  <span>{allGames} career games</span>
                  <span>{allPoints.toFixed(1)} career points</span>
                  <span>{careerAvg} avg</span>
                </div>
                {cs?.owned !== undefined && (
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className={cn('text-[10px] font-medium flex items-center gap-0.5', cs.owned ? 'text-emerald-400' : 'text-muted-foreground/40')}>
                      {cs.owned ? <UserCheck className="size-3" /> : <UserX className="size-3" />}
                      {cs.owned ? (cs.roster_name || 'Owned') : 'Free Agent'}
                    </span>
                    {cs.roster_avatar ? (
                      <img src={cs.roster_avatar} alt="" className="size-4 rounded-full ring-1 ring-border object-cover" />
                    ) : cs.roster_name ? (
                      <div className="size-4 rounded-full bg-muted ring-1 ring-border flex items-center justify-center text-[6px] font-bold text-muted-foreground">
                        {cs.roster_name.charAt(0).toUpperCase()}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        {cs?.overall_rank != null && (
          <Card className={cn('col-span-1 border-2', rankColor(cs.overall_rank))}>
            <CardContent className="py-4 flex flex-col items-center justify-center h-full gap-0.5">
              <span className="text-xs font-medium opacity-70">Overall</span>
              <span className="text-2xl font-bold tabular-nums">#{cs.overall_rank}</span>
            </CardContent>
          </Card>
        )}
        {cs?.position_rank != null && (
          <Card className={cn('col-span-1 border-2', posRankColor(cs.position_rank))}>
            <CardContent className="py-4 flex flex-col items-center justify-center h-full gap-0.5">
              <span className="text-xs font-medium opacity-70">{p.position}</span>
              <span className="text-2xl font-bold tabular-nums">#{cs.position_rank}</span>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Row 2: Usage (left) | Trend (mid) | Volatility (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Usage */}
        {currentSeason?.usage && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                <TrendingUp className="size-3 text-muted-foreground" />
                Usage &apos;{String(currentSeason.season).slice(2)}
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              {p.position === 'QB' && (() => {
                const yds = currentSeason.weeks.reduce((s, w) => s + (w.passing_yards || 0) + (w.rushing_yards || 0), 0)
                const g = currentSeason.weeks.length
                return (
                  <div className="flex gap-3 items-start">
                    <div className="flex flex-row items-center gap-3 flex-shrink-0">
                      <UsagePie label="Comp %" value={currentSeason.usage.completion_pct} max={100} unit="%" size="lg" />
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="flex justify-around px-1 py-2 rounded-lg bg-muted/10 border border-border/20">
                        <UsageStat label="Att/g" value={currentSeason.usage.attempts_per_game.toFixed(1)} />
                        <UsageStat label="Yards/g" value={g > 0 ? (yds / g).toFixed(0) : '0'} />
                      </div>
                      <div className="flex justify-around px-1 py-2 rounded-lg bg-muted/10 border border-border/20">
                        <UsageStat label="Yds/Att" value={currentSeason.usage.yards_per_carry.toFixed(1)} />
                        <UsageStat label="TD:INT" value={`${currentSeason.weeks.reduce((s, w) => s + (w.passing_tds || 0), 0)}:${currentSeason.weeks.reduce((s, w) => s + (w.passing_interceptions || 0), 0)}`} />
                      </div>
                    </div>
                  </div>
                )
              })()}
              {p.position === 'RB' && (() => {
                const touches = currentSeason.weeks.reduce((s, w) => s + (w.carries || 0) + (w.receptions || 0), 0)
                const yds = currentSeason.weeks.reduce((s, w) => s + (w.rushing_yards || 0) + (w.receiving_yards || 0), 0)
                const g = currentSeason.weeks.length
                return (
                  <div className="flex gap-3 items-start">
                    <div className="flex flex-row items-center gap-3 flex-shrink-0">
                      <UsagePie label="Carry Share" value={currentSeason.usage.carries_per_game} max={25} unit="/g" size="lg" />
                      <UsagePie label="Target Share" value={currentSeason.usage.targets_per_game} max={12} unit="/g" size="lg" />
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="flex justify-around px-1 py-2 rounded-lg bg-muted/10 border border-border/20">
                        <UsageStat label="Touches/g" value={g > 0 ? (touches / g).toFixed(1) : '0'} />
                        <UsageStat label="Yards/g" value={g > 0 ? (yds / g).toFixed(0) : '0'} />
                      </div>
                      <div className="flex justify-around px-1 py-2 rounded-lg bg-muted/10 border border-border/20">
                        <UsageStat label="Yds/Carry" value={currentSeason.usage.yards_per_carry.toFixed(1)} />
                        <UsageStat label="Carries" value={currentSeason.usage.carries} />
                      </div>
                    </div>
                  </div>
                )
              })()}
              {(p.position === 'WR' || p.position === 'TE') && (() => {
                const yds = currentSeason.weeks.reduce((s, w) => s + (w.receiving_yards || 0), 0)
                const g = currentSeason.weeks.length
                return (
                  <div className="flex gap-3 items-start">
                    <div className="flex flex-row items-center gap-3 flex-shrink-0">
                      <UsagePie label="Target Share" value={currentSeason.usage.targets_per_game} max={15} unit="/g" size="lg" />
                      <UsagePie label="Catch Rate" value={currentSeason.usage.receptions_per_game} max={12} unit="/g" size="lg" />
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="flex justify-around px-1 py-2 rounded-lg bg-muted/10 border border-border/20">
                        <UsageStat label="Yards/g" value={g > 0 ? (yds / g).toFixed(0) : '0'} />
                        <UsageStat label="Yds/Target" value={currentSeason.usage.yards_per_target.toFixed(1)} />
                      </div>
                      <div className="flex justify-around px-1 py-2 rounded-lg bg-muted/10 border border-border/20">
                        <UsageStat label="Targets" value={currentSeason.usage.targets} />
                        <UsageStat label="Receptions" value={currentSeason.usage.receptions} />
                      </div>
                    </div>
                  </div>
                )
              })()}
              {!['QB', 'RB', 'WR', 'TE'].includes(p.position) && (
                <div className="text-xs text-muted-foreground text-center py-6">Usage stats not tracked for {p.position}s</div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Trend */}
        {currentSeason && (() => {
          const scores = currentSeason.weeks.map((w) => w.fantasy_points)
          const seasonAvg = scores.reduce((s, x) => s + x, 0) / scores.length
          const last3 = scores.slice(-3)
          const last3Avg = last3.reduce((s, x) => s + x, 0) / last3.length
          const diff = seasonAvg > 0 ? (last3Avg - seasonAvg) / seasonAvg : 0
          const trend: 'up' | 'down' | 'stable' = diff > 0.2 ? 'up' : diff < -0.2 ? 'down' : 'stable'
          const trendColors = { up: 'text-emerald-400', down: 'text-red-400', stable: 'text-amber-400' }
          const trendBarBgs = { up: 'bg-emerald-500/60', down: 'bg-red-500/60', stable: 'bg-amber-500/60' }
          const trendColorBgs = { up: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', down: 'bg-red-500/20 text-red-300 border-red-500/30', stable: 'bg-amber-500/20 text-amber-300 border-amber-500/30' }

          const last5 = scores.slice(-5)
          const maxVal = Math.max(...last5, 1)
          const minVal = Math.min(...last5, 0)
          const range = Math.max(maxVal - minVal, 1)

          return (
            <Card className={cn('border-2', trendColorBgs[trend])}>
              <CardContent className="py-4 flex flex-col items-center justify-center h-full gap-2">
                <TrendingUp className={cn('size-6', trendColors[trend], trend === 'down' ? 'rotate-180' : '')} />
                <div className="flex flex-col items-center">
                  <span className={cn('text-sm font-bold', trendColors[trend])}>
                    {trend === 'up' ? 'Heating Up' : trend === 'down' ? 'Cooling Off' : 'Stable'}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60">
                    Last 3: {last3Avg.toFixed(1)} vs Avg: {seasonAvg.toFixed(1)}
                  </span>
                </div>

                {/* Sparkline with negative support */}
                {last5.length >= 3 && (
                  <div className="flex items-end gap-1.5 h-12 mt-1.5">
                    {last5.map((p, i) => {
                      const isLast = i === last5.length - 1
                      const h = range > 0 ? ((p - minVal) / range) * 44 : 22
                      const barH = Math.max(Math.abs(h), 3)
                      return (
                        <div key={i} className="flex flex-col items-center gap-0.5">
                          <div
                            title={`${p.toFixed(1)} pts`}
                            className={cn(
                              'w-5 rounded-t-sm transition-all',
                              isLast ? trendBarBgs[trend] : 'bg-muted/60',
                              p < 0 ? 'rounded-b-sm rounded-t-none' : '',
                            )}
                            style={{ height: `${barH}px` }}
                          />
                          <span className="text-[7px] tabular-nums text-muted-foreground/40">{p.toFixed(0)}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })()}

        {/* Volatility */}
        {currentSeason && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                <Gauge className="size-3 text-muted-foreground" />
                Volatility &apos;{String(currentSeason.season).slice(2)}
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <VolatilityChart season={currentSeason} />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Row 3-4: 9-col grid — Heatmap (2/9) | Consistency + Injury (5/9) | Schedule (2/9) */}
      <div className="grid grid-cols-1 lg:grid-cols-9 gap-4">
        {/* Left 2/9: Heatmap */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold flex items-center gap-1.5"><BarChart3 className="size-3 text-muted-foreground" />Weekly Heatmap</CardTitle>
          </CardHeader>
          <CardContent>
            <PlayerHeatGrid seasons={p.seasons} onHoverSeason={setFocusedSeason} />
          </CardContent>
        </Card>

        {/* Middle 5/9: Consistency + Injury stacked */}
        <div className="lg:col-span-5 space-y-4">
          {/* Consistency Chart */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-semibold flex items-center gap-1.5"><LineChart className="size-3 text-muted-foreground" />Consistency</CardTitle>
              <button
                onClick={() => setShowAllSeasons(!showAllSeasons)}
                className={cn('text-[9px] font-medium px-2 py-0.5 rounded-full border transition-colors', showAllSeasons ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/30 text-muted-foreground border-border/40')}
              >
                {showAllSeasons ? 'All Years' : 'Current Year'}
              </button>
            </CardHeader>
            <CardContent>
              <PlayerLineChart seasons={p.seasons} focusedSeason={showAllSeasons ? null : (focusedSeason || p.seasons[0]?.season)} />
            </CardContent>
          </Card>

          {/* Injury History */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                <HeartPulse className="size-3 text-muted-foreground" />
                Injury History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {p.seasons.map((s) => (
                  <HealthBar key={s.season} label={`'${String(s.season).slice(2)}`} played={s.games} total={s.games_possible} />
                ))}
              </div>
              <div className="mt-1.5 pt-1.5 border-t border-border/20">
                <HealthBar label="Career" played={allGames} total={allPossible} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right 2/9: Schedule */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                <Calendar className="size-3 text-muted-foreground" />
                Schedule
              </CardTitle>
            </CardHeader>
            <CardContent>
              {schedule && team ? (
                <div className="space-y-1">
                  {schedule.games.map((g) => (
                    <div
                      key={g.week}
                      className={cn(
                        'flex items-center gap-1.5 py-1 px-1.5 rounded text-[9px] transition-colors',
                        g.played ? 'opacity-50' : 'bg-primary/5 border border-primary/15',
                      )}
                    >
                      <span className="w-5 tabular-nums text-muted-foreground/50 font-medium">W{g.week}</span>
                      <img src={g.opponent_logo} alt="" className="size-3.5 rounded-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                      <span className="flex-1 truncate font-medium">{g.opponent}</span>
                      <span className="tabular-nums font-semibold">
                        {g.result || (g.is_home ? 'vs' : '@')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-muted-foreground/50 text-center py-4">No schedule data</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
