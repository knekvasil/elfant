import { useCallback, useEffect, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Table2, ScrollText, Swords, Trophy, ArrowLeftRight, Users, TrendingUp, BarChart3, Gauge } from 'lucide-react'
import { cn, formatStatus } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import Tooltip from '../components/ui/tooltip'
import { Badge } from '../components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Skeleton } from '../components/ui/skeleton'
import {
  BreadcrumbRoot,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '../components/ui/breadcrumb'
import Standings, { type StandingsMode } from '../components/Standings'
import DraftGrid from '../components/DraftGrid'
import Matchups from '../components/Matchups'
import PlayoffBracket from '../components/PlayoffBracket'
import RankingsChart from '../components/RankingsChart'
import PointsDiffChart from '../components/PointsDiffChart'
import TransactionsTimeline from '../components/TransactionsTimeline'
import PlayerSearch from '../components/PlayerSearch'
import WeeklyBarChart from '../components/WeeklyBarChart'
import EfficiencyBarChart from '../components/EfficiencyBarChart'
import ScatterPlots from '../components/ScatterPlots'
import PowerRankings from '../components/PowerRankings'
import { fetchLeague, fetchTeamStats } from '../lib/api'
import type { LeagueData, TeamStatsData } from '../types'

export default function League() {
  const { groupId, seasonLeagueId } = useParams<{ groupId: string, seasonLeagueId: string }>()
  const [data, setData] = useState<LeagueData | null>(null)
  const [teamStats, setTeamStats] = useState<TeamStatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') || 'power'
  const [standingsMode, setStandingsMode] = useState<StandingsMode>('standard')
  const [hoveredRosterId, setHoveredRosterId] = useState<number | null>(null)
  const [selectedRosterIds, setSelectedRosterIds] = useState<Set<number>>(new Set())

  const handleHover = (id: number | null) => setHoveredRosterId(id)
  const activeHighlightIds = hoveredRosterId != null
    ? new Set([...selectedRosterIds, hoveredRosterId])
    : selectedRosterIds
  const handleClick = (id: number) => {
    setSelectedRosterIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const load = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const [d, ts] = await Promise.all([fetchLeague(id), fetchTeamStats(id).catch(() => null)])
      setData(d)
      setTeamStats(ts)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load league')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (seasonLeagueId) load(seasonLeagueId)
  }, [seasonLeagueId, load])

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-4 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="max-w-6xl mx-auto p-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">{error || 'League not found'}</p>
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-1.5 text-sm font-medium h-9 px-4 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors mt-4"
            >
              Back
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { league, rosters, previous, next, drafts, max_week } = data
  const statusColor =
    league.status === 'complete'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
      : league.status === 'in_season'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
        : 'border-blue-500/30 bg-blue-500/10 text-blue-400'

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold truncate">{league.name}</h1>
          <div className="flex items-center gap-2 text-muted-foreground text-sm mt-0.5">
            <span>{league.season}</span>
            <span className="text-border">·</span>
            <Badge variant="outline" className={statusColor}>
              {formatStatus(league.status)}
            </Badge>
            <span className="text-border">·</span>
            <span>{rosters.length} teams</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {previous && (
            <Link
              to={`/league/${groupId}/${previous.league_id}`}
              className="inline-flex items-center justify-center gap-1 text-sm font-medium h-8 px-3 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <ChevronLeft className="size-3.5" />
              {previous.season}
            </Link>
          )}
          {next && (
            <Link
              to={`/league/${groupId}/${next.league_id}`}
              className="inline-flex items-center justify-center gap-1 text-sm font-medium h-8 px-3 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              {next.season}
              <ChevronRight className="size-3.5" />
            </Link>
          )}

        </div>
      </div>

      <BreadcrumbRoot>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href={`/league/${groupId}`}>League Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{league.season}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </BreadcrumbRoot>

      <Tabs value={tab} onValueChange={(v) => setSearchParams(v === 'power' ? {} : { tab: v })}>
        <TabsList className="overflow-x-auto flex-nowrap w-full">
          <TabsTrigger value="power">
            <Gauge className="size-3.5 shrink-0" />
            <span className="hidden sm:inline">Power</span>
          </TabsTrigger>
          <TabsTrigger value="charts">
            <BarChart3 className="size-3.5 shrink-0" />
            <span className="hidden sm:inline">Profiles</span>
          </TabsTrigger>
          <TabsTrigger value="standings">
            <Table2 className="size-3.5 shrink-0" />
            <span className="hidden sm:inline">Standings</span>
          </TabsTrigger>
          <TabsTrigger value="draft">
            <ScrollText className="size-3.5 shrink-0" />
            <span className="hidden sm:inline">Draft</span>
          </TabsTrigger>
          <TabsTrigger value="matchups">
            <Swords className="size-3.5 shrink-0" />
            <span className="hidden sm:inline">Matchups</span>
          </TabsTrigger>
          <TabsTrigger value="playoffs">
            <Trophy className="size-3.5 shrink-0" />
            <span className="hidden sm:inline">Playoffs</span>
          </TabsTrigger>
          <TabsTrigger value="players">
            <Users className="size-3.5 shrink-0" />
            <span className="hidden sm:inline">Players</span>
          </TabsTrigger>
          <TabsTrigger value="transactions">
            <ArrowLeftRight className="size-3.5 shrink-0" />
            <span className="hidden sm:inline">Activity</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="power">
          <PowerRankings
            leagueId={league.league_id}
            rosters={rosters}
            hoveredRosterId={hoveredRosterId}
            onHover={handleHover}
            onClick={handleClick}
            highlightedRosterIds={activeHighlightIds}
          />
        </TabsContent>
        <TabsContent value="charts">
          {teamStats ? (
            <ScatterPlots
              teamStats={teamStats}
              rosters={rosters}
              hoveredRosterId={hoveredRosterId}
              onHover={handleHover}
              onClick={handleClick}
              highlightedRosterIds={activeHighlightIds}
            />
          ) : (
            <Card>
              <CardContent className="pt-10 pb-10 text-muted-foreground text-sm text-center flex flex-col items-center justify-center gap-3">
                <BarChart3 className="size-8 text-muted-foreground/30" />
                <div>
                  <p className="font-medium">No season data yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Stats become available once the season starts.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="standings">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border/40 bg-card/30 p-3 self-start">
              <div className="text-xs font-semibold text-muted-foreground mb-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Table2 className="size-3.5" />
                  Standings
                </div>
                <div className="flex gap-1 bg-muted/20 rounded-xl p-1 border border-border/40 shadow-sm">
                  {(['standard', 'median', 'all_play', 'efficiency'] as const).map((m) => (
                    <Tooltip key={m} content={
                      m === 'standard' ? 'Actual head-to-head record. Each matchup is a win or loss.' :
                      m === 'median' ? 'What if every team faced the median score each week? Rewards consistency above the median.' :
                      m === 'all_play' ? 'What if every team played every other team each week? True measure of team strength.' :
                      'What if you set the optimal lineup each week? Measures lineup management skill.'
                    }>
                      <button
                        onClick={() => setStandingsMode(m)}
                        className={cn('text-[10px] sm:text-xs font-semibold px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-lg transition-all capitalize', standingsMode === m ? 'bg-primary text-primary-foreground shadow-md scale-105' : 'text-muted-foreground hover:text-foreground')}
                      >
                        {m === 'all_play' ? 'All-Play' : m}
                      </button>
                    </Tooltip>
                  ))}
                </div>
              </div>
              <Standings rosters={rosters} hoveredRosterId={hoveredRosterId} onHover={handleHover} onClick={handleClick} mode={standingsMode} leagueId={league.league_id} selectedRosterIds={selectedRosterIds} teamStats={teamStats} />
            </div>
            <div className="flex flex-col gap-3 min-h-0">
              <div className="rounded-lg border border-border/40 bg-card/30 p-3 flex-1 flex flex-col min-h-0">
                <div className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1.5 shrink-0">
                  {standingsMode === 'efficiency' ? <BarChart3 className="size-3.5" /> : <TrendingUp className="size-3.5" />}
                  <Tooltip content={standingsMode === 'efficiency' ? "Cumulative optimal points each week — a fair measure of roster strength regardless of opponent luck." : "Each team's rank trajectory through the season using the selected scoring method"}>
                    <span className="cursor-help">
                      {standingsMode === 'efficiency' ? 'Cumulative Optimal PF' : standingsMode === 'median' ? 'Median Placement' : standingsMode === 'all_play' ? 'All-Play Placement' : 'Weekly Placement'}
                    </span>
                  </Tooltip>
                </div>
                <div className="flex-1 min-h-0">
                  {standingsMode === 'efficiency' ? (
                    <PointsDiffChart leagueId={league.league_id} highlightedRosterIds={activeHighlightIds} mode={standingsMode} compact />
                  ) : (
                    <RankingsChart leagueId={league.league_id} highlightedRosterIds={activeHighlightIds} mode={standingsMode} compact />
                  )}
                </div>
              </div>
              <div className="rounded-lg border border-border/40 bg-card/30 p-3 flex-1 flex flex-col min-h-0">
                <div className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1.5 shrink-0">
                  <BarChart3 className="size-3.5" />
                  <Tooltip content={
                    standingsMode === 'all_play' ? 'PF, PA, league average, and optimal score per week for selected teams.' :
                    standingsMode === 'efficiency' ? 'Actual PF as a percentage of optimal PF each week. Higher = better lineup decisions.' :
                    standingsMode === 'median' ? 'Cumulative PF minus cumulative median score. Positive = consistently above average.' :
                    'Cumulative PF minus PA. Shows how your total scoring compares to opponents.'
                  }>
                    <span className="cursor-help">{standingsMode === 'all_play' ? 'Weekly Breakdown' : standingsMode === 'efficiency' ? 'Efficiency per Week' : (standingsMode === 'median' ? 'Points vs Median' : 'Points For/Against Diff')}</span>
                  </Tooltip>
                </div>
                <div className="flex-1 min-h-0">
                  {standingsMode === 'all_play' ? (
                    <WeeklyBarChart leagueId={league.league_id} highlightedRosterIds={activeHighlightIds} compact />
                  ) : standingsMode === 'efficiency' ? (
                    <EfficiencyBarChart leagueId={league.league_id} highlightedRosterIds={activeHighlightIds} compact />
                  ) : (
                    <PointsDiffChart leagueId={league.league_id} highlightedRosterIds={activeHighlightIds} mode={standingsMode} compact />
                  )}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="draft">
          {drafts.length > 0 ? (
            <DraftGrid rosters={rosters} drafts={drafts} leagueId={league.league_id} groupId={groupId!} />
          ) : (
            <Card>
              <CardContent className="pt-10 pb-10 text-muted-foreground text-sm text-center flex flex-col items-center justify-center gap-3">
                <ScrollText className="size-8 text-muted-foreground/30" />
                <div>
                  <p className="font-medium">No draft data</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">The draft hasn't taken place yet for this season.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="matchups">
          {max_week > 0 ? (
            <Matchups leagueId={league.league_id} maxWeek={max_week} groupId={groupId!} />
          ) : (
            <Card>
              <CardContent className="pt-10 pb-10 text-muted-foreground text-sm text-center flex flex-col items-center justify-center gap-3">
                <Swords className="size-8 text-muted-foreground/30" />
                <div>
                  <p className="font-medium">No matchups yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Matchups will appear once the season starts.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="playoffs">
          <PlayoffBracket leagueId={league.league_id} />
        </TabsContent>
        <TabsContent value="players">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Player Search</CardTitle>
            </CardHeader>
            <CardContent>
              <PlayerSearch leagueId={league.league_id} groupId={groupId!} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">League Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <TransactionsTimeline leagueId={league.league_id} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
