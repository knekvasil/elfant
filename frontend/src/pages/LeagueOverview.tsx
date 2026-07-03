import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Users, Circle, Trophy, Trash2, Medal, CalendarDays, Crown, TrendingUp, ArrowUp, Swords, Zap, Info } from 'lucide-react'
import { cn } from '../lib/utils'
import { Badge } from '../components/ui/badge'
import { Skeleton } from '../components/ui/skeleton'
import {
  BreadcrumbRoot,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbPage,
} from '../components/ui/breadcrumb'
import Tooltip from '../components/ui/tooltip'
import LeagueTimeline from '../components/LeagueTimeline'
import { fetchLeagueOverview } from '../lib/api'
import type { LeagueOverviewData } from '../types'

const statusStyle = (status: string) => {
  const s = status === 'complete' ? 'emerald' : status === 'in_season' ? 'amber' : 'blue'
  return {
    dot: `text-${s}-400`,
    badge: `border-${s}-500/30 bg-${s}-500/10 text-${s}-400`,
  }
}

const statusLabel = (status: string) =>
  status === 'in_season' ? 'Live' : status === 'complete' ? 'Complete' : status

const placementClass = (i: number) =>
  i === 0 ? 'text-amber-400' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-amber-700' : 'text-muted-foreground'

function AvatarImg({ src, name }: { src: string | null; name: string }) {
  return src ? (
    <img src={src} alt="" className="size-5 rounded-full shrink-0" />
  ) : (
    <div className="size-5 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold shrink-0">
      {name.charAt(0)}
    </div>
  )
}

function SectionBox({ icon, title, children, className }: { icon: React.ReactNode; title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-lg border border-border/40 bg-card/30 p-3', className)}>
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-2">
        {icon}
        {title}
      </div>
      {children}
    </div>
  )
}

export default function LeagueOverview() {
  const { groupId } = useParams<{ groupId: string }>()
  const [data, setData] = useState<LeagueOverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!groupId) return
    setLoading(true)
    setError(null)
    fetchLeagueOverview(groupId)
      .then(setData)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load league'))
      .finally(() => setLoading(false))
  }, [groupId])

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-4 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="rounded-lg border border-border/40 bg-card/30 p-4">
          <p className="text-destructive">{error || 'League not found'}</p>
          <Link to="/"
            className="inline-flex items-center justify-center gap-1.5 text-sm font-medium h-9 px-4 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors mt-4">
            Back
          </Link>
        </div>
      </div>
    )
  }

  const last = data.seasons[data.seasons.length - 1]
  const seasonLinks = Object.fromEntries(data.seasons.map(s => [s.season, s.league_id]))

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-5">
      <BreadcrumbRoot>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>League Home</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </BreadcrumbRoot>

      <div>
        <h1 className="text-2xl font-bold">Sleeper League History</h1>
        <p className="text-muted-foreground text-sm mt-0.5 flex items-center gap-1.5">
          <Users className="size-3.5" />
          {data.total_seasons} {data.total_seasons === 1 ? 'season' : 'seasons'}
          {data.total_teams > 0 && ` · ${data.total_teams} teams per year`}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="space-y-3">
          <SectionBox icon={<CalendarDays className="size-3.5" />} title="Season History">
            <div className="space-y-0.5">
              {data.seasons.map(s => (
                <Link
                  key={s.league_id}
                  to={`/league/${data.group_id}/${s.league_id}`}
                  className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-accent/30 transition-colors"
                >
                  <Circle className={cn('size-2 shrink-0 fill-current', statusStyle(s.status).dot)} />
                  <span className="text-xs font-semibold w-7 shrink-0">{'\''}{s.season.slice(2)}</span>
                  <Badge variant="outline" className={cn('text-[9px] px-1 py-0 h-4', statusStyle(s.status).badge)}>
                    {statusLabel(s.status)}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{s.total_rosters} players</span>
                </Link>
              ))}
            </div>
          </SectionBox>
          {data.participants && (
            <LeagueTimeline
              groupId={data.group_id}
              participants={data.participants}
              seasonLinks={seasonLinks}
            />
          )}
          {data.individual_events?.best_reg_season && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 mb-2">
                <ArrowUp className="size-3.5" />
                Best Regular Season
              </div>
              <div className="flex items-center gap-2">
                {data.individual_events.best_reg_season.avatar && <img src={data.individual_events.best_reg_season.avatar} alt="" className="size-7 rounded-full" />}
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{data.individual_events.best_reg_season.team_name}</div>
                  <div className="text-[10px] text-muted-foreground">{data.individual_events.best_reg_season.owner_name} · {data.individual_events.best_reg_season.season} · {data.individual_events.best_reg_season.wins}-{data.individual_events.best_reg_season.losses}{data.individual_events.best_reg_season.ties > 0 ? `-${data.individual_events.best_reg_season.ties}` : ''} · {data.individual_events.best_reg_season.pf} PF</div>
                </div>
              </div>
            </div>
          )}
          {data.individual_events?.worst_reg_season && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-red-400 mb-2">
                <ArrowUp className="size-3.5 rotate-180" />
                Worst Regular Season
              </div>
              <div className="flex items-center gap-2">
                {data.individual_events.worst_reg_season.avatar && <img src={data.individual_events.worst_reg_season.avatar} alt="" className="size-7 rounded-full" />}
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{data.individual_events.worst_reg_season.team_name}</div>
                  <div className="text-[10px] text-muted-foreground">{data.individual_events.worst_reg_season.owner_name} · {data.individual_events.worst_reg_season.season} · {data.individual_events.worst_reg_season.wins}-{data.individual_events.worst_reg_season.losses}{data.individual_events.worst_reg_season.ties > 0 ? `-${data.individual_events.worst_reg_season.ties}` : ''} · {data.individual_events.worst_reg_season.pf} PF</div>
                </div>
              </div>
            </div>
          )}
          {data.individual_events?.highest_score && (
            <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-400 mb-2">
                <Zap className="size-3.5" />
                Highest Scoring Week
              </div>
              <div className="flex items-center gap-2">
                {data.individual_events.highest_score.avatar && <img src={data.individual_events.highest_score.avatar} alt="" className="size-7 rounded-full" />}
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{data.individual_events.highest_score.team_name}</div>
                  <div className="text-[10px] text-muted-foreground">{data.individual_events.highest_score.owner_name} · {data.individual_events.highest_score.pts} pts · Week {data.individual_events.highest_score.week} · {data.individual_events.highest_score.season}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {last && (
            <>
              <div className="rounded-lg border-amber-500/50 bg-gradient-to-b from-amber-500/10 to-transparent ring-1 ring-amber-500/30 shadow-[0_0_15px_-3px_rgba(251,191,36,0.15)] p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="size-4 text-amber-400" />
                  <span className="text-xs font-semibold text-amber-400/80 uppercase tracking-wider">Reigning Champion</span>
                </div>
                {last.champion ? (
                  <div className="flex items-center gap-2">
                    {last.champion_avatar && <img src={last.champion_avatar} alt="" className="size-7 rounded-full ring-1 ring-amber-500/30" />}
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{last.champion}</div>
                      <div className="text-[10px] text-muted-foreground">{last.champion_owner} · {last.season}</div>
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground italic">TBD</span>
                )}
              </div>

              <div className="rounded-lg border border-border/40 bg-card/30 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Trash2 className="size-4 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reigning Trash King</span>
                </div>
                {last.trash_king ? (
                  <div className="flex items-center gap-2">
                    {last.trash_king_avatar && <img src={last.trash_king_avatar} alt="" className="size-7 rounded-full" />}
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{last.trash_king}</div>
                      <div className="text-[10px] text-muted-foreground">{last.trash_king_owner} · {last.season}</div>
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground italic">TBD</span>
                )}
              </div>
            </>
          )}

          {data.career_stats && data.career_stats.length > 0 && (
            <div className="rounded-lg border border-border/40 bg-card/30 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-2">
                <TrendingUp className="size-3.5" />
                All Time Power Ranking
                <Tooltip content={
                  <div className="space-y-1">
                    <p><b>Composite Score</b> — weighted average of 4 normalized metrics</p>
                    <p>▸ Win% (30%) — career regular season win rate</p>
                    <p>▸ Avg PF (20%) — average points for per season</p>
                    <p>▸ Playoff Rate (25%) — % of seasons making winners bracket</p>
                    <p>▸ Championship Score (25%) — (gold×3 + silver×2 + bronze) ÷ seasons × 100</p>
                    <p className="pt-1 text-muted-foreground/60">Each metric scaled 0-1 relative to the league leader, then averaged and scored 0-100.</p>
                  </div>
                }>
                  <Info className="size-3 text-muted-foreground/50 cursor-help" />
                </Tooltip>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 px-2 pb-1 text-[10px] font-semibold text-muted-foreground">
                  <span className="w-5 shrink-0 text-center">#</span>
                  <span className="size-6 shrink-0" />
                  <span className="flex-1 min-w-0">Owner</span>
                  <span className="w-12 text-right">Score</span>
                  <span className="w-8 text-right">W%</span>
                  <span className="w-8 text-right">PF</span>
                  <span className="w-8 text-right">PO%</span>
                </div>
                {data.career_stats.map((cs, i) => {
                  const hue = 120 - (data.career_stats.length > 1 ? (i / (data.career_stats.length - 1)) : 0) * 120
                  const wCont = (cs.win_pct_norm * 0.30 * 100).toFixed(1)
                  const pCont = (cs.avg_pf_norm * 0.20 * 100).toFixed(1)
                  const poCont = (cs.playoff_pct_norm * 0.25 * 100).toFixed(1)
                  const cCont = (cs.championship_score_norm * 0.25 * 100).toFixed(1)
                  return (
                    <Tooltip key={cs.owner_id} content={
                      <div className="space-y-1">
                        <div className="text-[10px] font-semibold">{cs.display_name}</div>
                        <div className="h-px bg-border/30 my-1" />
                        <div className="text-[9px] leading-relaxed text-muted-foreground/80">
                          Win%: {cs.win_pct}% × 30% → <b>{wCont}</b> of 30
                        </div>
                        <div className="text-[9px] leading-relaxed text-muted-foreground/80">
                          Avg PF: {cs.avg_pf} × 20% → <b>{pCont}</b> of 20
                        </div>
                        <div className="text-[9px] leading-relaxed text-muted-foreground/80">
                          Playoff%: {cs.playoff_pct}% × 25% → <b>{poCont}</b> of 25
                        </div>
                        <div className="text-[9px] leading-relaxed text-muted-foreground/80">
                          Champ Score: {cs.championship_score} × 25% → <b>{cCont}</b> of 25
                        </div>
                        <div className="h-px bg-border/30 my-1" />
                        <div className="text-[10px] font-semibold">Composite: {cs.composite}</div>
                      </div>
                    }>
                      <div
                        className="flex items-center gap-2 px-2 py-1 rounded-md transition-colors"
                        style={{ backgroundColor: `hsla(${hue}, 55%, 35%, 0.15)` }}
                      >
                        <span className="w-5 shrink-0 text-center text-[11px] font-bold" style={{ color: `hsl(${hue}, 75%, 45%)` }}>{i + 1}</span>
                        <AvatarImg src={cs.avatar} name={cs.display_name} />
                        <span className="text-xs font-semibold truncate flex-1">{cs.display_name}</span>
                        <span className="text-xs font-bold tabular-nums text-right w-12">{cs.composite.toFixed(0)}</span>
                        <span className="text-[10px] font-mono tabular-nums text-right w-8 text-muted-foreground">{cs.win_pct}%</span>
                        <span className="text-[10px] font-mono tabular-nums text-right w-8 text-muted-foreground">{cs.avg_pf}</span>
                        <span className="text-[10px] font-mono tabular-nums text-right w-8 text-muted-foreground">{cs.playoff_pct}%</span>
                      </div>
                    </Tooltip>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {data.all_time_medals.length > 0 && (
            <SectionBox icon={<Trophy className="size-3.5" />} title="Hall of Fame">
              <div className="space-y-0.5">
                {data.all_time_medals.map((m, i) => (
                  <div key={m.owner_name} className="flex items-center gap-2 px-2 py-1 rounded-md">
                    <span className={cn('text-xs font-mono w-6 shrink-0 text-center mr-0.5', placementClass(i))}>
                      {i === 0 ? '1st' : i === 1 ? '2nd' : i === 2 ? '3rd' : `${i + 1}th`}
                    </span>
                    <AvatarImg src={m.avatar} name={m.owner_name} />
                    <span className="text-xs truncate flex-1">{m.owner_name}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {m.gold > 0 && <span className="flex items-center gap-0.5 text-[10px]"><Medal className="size-3 text-amber-400" />{m.gold}</span>}
                      {m.silver > 0 && <span className="flex items-center gap-0.5 text-[10px]"><Medal className="size-3 text-gray-400" />{m.silver}</span>}
                      {m.bronze > 0 && <span className="flex items-center gap-0.5 text-[10px]"><Medal className="size-3 text-amber-700" />{m.bronze}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </SectionBox>
          )}

          {data.trash_king_medals && data.trash_king_medals.length > 0 && (
            <SectionBox icon={<Trash2 className="size-3.5" />} title="Trash King Hall of Fame">
              <div className="space-y-0.5">
                {data.trash_king_medals.slice(0, 10).map((m, i) => (
                  <div key={m.owner_name} className="flex items-center gap-2 px-2 py-1 rounded-md">
                    <span className={cn('text-xs font-mono w-6 shrink-0 text-center mr-0.5', placementClass(i))}>
                      {i === 0 ? '1st' : i === 1 ? '2nd' : i === 2 ? '3rd' : `${i + 1}th`}
                    </span>
                    <AvatarImg src={m.avatar} name={m.owner_name} />
                    <span className="text-xs truncate flex-1">{m.owner_name}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {m.gold > 0 && <span className="flex items-center gap-0.5 text-[10px]"><Trash2 className="size-3 text-amber-400" />{m.gold}</span>}
                      {m.silver > 0 && <span className="flex items-center gap-0.5 text-[10px]"><Trash2 className="size-3 text-gray-400" />{m.silver}</span>}
                      {m.bronze > 0 && <span className="flex items-center gap-0.5 text-[10px]"><Trash2 className="size-3 text-amber-700" />{m.bronze}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </SectionBox>
          )}
          {data.individual_events?.biggest_playoff_upset && (
            <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-400 mb-2">
                <TrendingUp className="size-3.5" />
                Biggest Playoff Upset
              </div>
              <div className="flex items-center gap-1">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  {data.individual_events.biggest_playoff_upset.winner_avatar && <img src={data.individual_events.biggest_playoff_upset.winner_avatar} alt="" className="size-6 rounded-full shrink-0" />}
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate">{data.individual_events.biggest_playoff_upset.winner_name}</div>
                    <div className="text-[9px] text-muted-foreground">#{data.individual_events.biggest_playoff_upset.lower_seed} seed · {data.individual_events.biggest_playoff_upset.winner_owner}</div>
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground mx-1">beat</span>
                <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                  <div className="min-w-0 text-right">
                    <div className="text-xs font-semibold truncate">{data.individual_events.biggest_playoff_upset.loser_name}</div>
                    <div className="text-[9px] text-muted-foreground">#{data.individual_events.biggest_playoff_upset.higher_seed} seed · {data.individual_events.biggest_playoff_upset.loser_owner}</div>
                  </div>
                  {data.individual_events.biggest_playoff_upset.loser_avatar && <img src={data.individual_events.biggest_playoff_upset.loser_avatar} alt="" className="size-6 rounded-full shrink-0" />}
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">Round {data.individual_events.biggest_playoff_upset.round} · {data.individual_events.biggest_playoff_upset.season}</div>
            </div>
          )}
          {data.individual_events?.top_rivalries && data.individual_events.top_rivalries[0] && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-red-400 mb-2">
                <Swords className="size-3.5" />
                Stop, Stop he&apos;s already dead!
              </div>
              <div className="flex items-center gap-1">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  {data.individual_events.top_rivalries[0].dominant_avatar && <img src={data.individual_events.top_rivalries[0].dominant_avatar} alt="" className="size-6 rounded-full shrink-0" />}
                  <span className="text-xs font-semibold truncate">{data.individual_events.top_rivalries[0].dominant}</span>
                </div>
                <span className="text-xs font-mono tabular-nums font-semibold text-red-400">{data.individual_events.top_rivalries[0].dom_wins}</span>
                <span className="text-[10px] text-muted-foreground mx-0.5">v.</span>
                <span className="text-xs font-mono tabular-nums font-semibold">{data.individual_events.top_rivalries[0].domed_wins}</span>
                <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                  <span className="text-xs font-semibold truncate text-right">{data.individual_events.top_rivalries[0].dominated}</span>
                  {data.individual_events.top_rivalries[0].dominated_avatar && <img src={data.individual_events.top_rivalries[0].dominated_avatar} alt="" className="size-6 rounded-full shrink-0" />}
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">{data.individual_events.top_rivalries[0].total} head-to-head meetings</div>
            </div>
          )}
          {data.individual_events?.biggest_blowout && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 mb-2">
                <TrendingUp className="size-3.5" />
                Biggest Blowout
              </div>
              <div className="flex items-center gap-1">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  {data.individual_events.biggest_blowout.winner_avatar && <img src={data.individual_events.biggest_blowout.winner_avatar} alt="" className="size-6 rounded-full shrink-0" />}
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate">{data.individual_events.biggest_blowout.winner}</div>
                    <div className="text-[9px] text-muted-foreground">{data.individual_events.biggest_blowout.winner_owner}</div>
                  </div>
                  <span className={cn('text-xs font-mono tabular-nums shrink-0', 'text-emerald-400')}>{data.individual_events.biggest_blowout.winner_pts}</span>
                </div>
                <span className="text-[10px] text-muted-foreground mx-1">vs</span>
                <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                  <span className={cn('text-xs font-mono tabular-nums shrink-0', 'text-red-400')}>{data.individual_events.biggest_blowout.loser_pts}</span>
                  <div className="min-w-0 text-right">
                    <div className="text-xs font-semibold truncate">{data.individual_events.biggest_blowout.loser}</div>
                    <div className="text-[9px] text-muted-foreground">{data.individual_events.biggest_blowout.loser_owner}</div>
                  </div>
                  {data.individual_events.biggest_blowout.loser_avatar && <img src={data.individual_events.biggest_blowout.loser_avatar} alt="" className="size-6 rounded-full shrink-0" />}
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">Week {data.individual_events.biggest_blowout.week} · {data.individual_events.biggest_blowout.season}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
