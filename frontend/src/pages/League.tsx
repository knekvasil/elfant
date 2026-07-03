import { useCallback, useEffect, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { RefreshCw, ChevronLeft, ChevronRight, Table2, ScrollText, Swords, Trophy, ArrowLeftRight, Users, TrendingUp, BarChart3 } from 'lucide-react'
import { cn } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
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
import RangeBarChart from '../components/RangeBarChart'
import { fetchLeague, refreshLeague, fetchTeamStats } from '../lib/api'
import type { LeagueData, TeamStatsData } from '../types'

export default function League() {
  const { leagueId } = useParams<{ leagueId: string }>()
  const [data, setData] = useState<LeagueData | null>(null)
  const [teamStats, setTeamStats] = useState<TeamStatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') || 'standings'
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
    if (leagueId) load(leagueId)
  }, [leagueId, load])

  const handleRefresh = async () => {
    if (!leagueId) return
    await refreshLeague(leagueId)
    await load(leagueId)
  }

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
              {league.status}
            </Badge>
            <span className="text-border">·</span>
            <span>{rosters.length} teams</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {previous && (
            <Link
              to={`/league/${previous.league_id}`}
              className="inline-flex items-center justify-center gap-1 text-sm font-medium h-8 px-3 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <ChevronLeft className="size-3.5" />
              {previous.season}
            </Link>
          )}
          {next && (
            <Link
              to={`/league/${next.league_id}`}
              className="inline-flex items-center justify-center gap-1 text-sm font-medium h-8 px-3 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              {next.season}
              <ChevronRight className="size-3.5" />
            </Link>
          )}
          <Button size="sm" variant="outline" onClick={handleRefresh}>
            <RefreshCw className="size-3.5 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      <BreadcrumbRoot>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{league.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </BreadcrumbRoot>

      <Tabs value={tab} onValueChange={(v) => setSearchParams(v === 'standings' ? {} : { tab: v })}>
        <TabsList>
          <TabsTrigger value="standings">
            <Table2 className="size-3.5 mr-1.5" />
            Standings
          </TabsTrigger>
          {drafts.length > 0 && (
            <TabsTrigger value="draft">
              <ScrollText className="size-3.5 mr-1.5" />
              Draft
            </TabsTrigger>
          )}
          {max_week > 0 && (
            <TabsTrigger value="matchups">
              <Swords className="size-3.5 mr-1.5" />
              Matchups
            </TabsTrigger>
          )}
          <TabsTrigger value="playoffs">
            <Trophy className="size-3.5 mr-1.5" />
            Playoffs
          </TabsTrigger>
          <TabsTrigger value="charts">
            <BarChart3 className="size-3.5 mr-1.5" />
            Charts
          </TabsTrigger>
          <TabsTrigger value="players">
            <Users className="size-3.5 mr-1.5" />
            Players
          </TabsTrigger>
          <TabsTrigger value="transactions">
            <ArrowLeftRight className="size-3.5 mr-1.5" />
            Activity
          </TabsTrigger>
        </TabsList>
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
                    <button
                      key={m}
                      onClick={() => setStandingsMode(m)}
                      className={cn('text-xs font-semibold px-3 py-1.5 rounded-lg transition-all capitalize', standingsMode === m ? 'bg-primary text-primary-foreground shadow-md scale-105' : 'text-muted-foreground hover:text-foreground')}
                    >
                      {m === 'all_play' ? 'All-Play' : m}
                    </button>
                  ))}
                </div>
              </div>
              <Standings rosters={rosters} hoveredRosterId={hoveredRosterId} onHover={handleHover} onClick={handleClick} mode={standingsMode} leagueId={league.league_id} selectedRosterIds={selectedRosterIds} teamStats={teamStats} />
            </div>
            <div className="flex flex-col gap-3 min-h-0">
              <div className="rounded-lg border border-border/40 bg-card/30 p-3 flex-1 flex flex-col min-h-0">
                <div className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1.5 shrink-0">
                  <TrendingUp className="size-3.5" />
                  {standingsMode === 'median' ? 'Median Placement' : standingsMode === 'all_play' ? 'All-Play Placement' : standingsMode === 'efficiency' ? 'Efficiency Placement' : 'Weekly Placement'}
                </div>
                <div className="flex-1 min-h-0">
                  <RankingsChart leagueId={league.league_id} highlightedRosterIds={activeHighlightIds} mode={standingsMode} compact />
                </div>
              </div>
              <div className="rounded-lg border border-border/40 bg-card/30 p-3 flex-1 flex flex-col min-h-0">
                <div className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1.5 shrink-0">
                  <BarChart3 className="size-3.5" />
                  {standingsMode === 'all_play' ? 'Weekly Breakdown' : standingsMode === 'efficiency' ? 'Efficiency per Week' : (standingsMode === 'median' ? 'Points vs Median' : 'Points For/Against Diff')}
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
        {drafts.length > 0 && (
          <TabsContent value="draft">
            <DraftGrid rosters={rosters} drafts={drafts} leagueId={league.league_id} />
          </TabsContent>
        )}
        {max_week > 0 && (
          <TabsContent value="matchups">
            <Matchups leagueId={league.league_id} maxWeek={max_week} />
          </TabsContent>
        )}
        <TabsContent value="charts">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-lg border border-border/40 bg-card/30 p-3 flex flex-col min-h-0">
              <div className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1.5 shrink-0">
                <BarChart3 className="size-3.5" />
                Standard Consistency (avg ± σ)
              </div>
              <div className="flex-1 min-h-0">
                <RangeBarChart leagueId={league.league_id} highlightedRosterIds={activeHighlightIds} mode="standard" rosters={rosters} compact />
              </div>
            </div>
            <div className="rounded-lg border border-border/40 bg-card/30 p-3 flex flex-col min-h-0">
              <div className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1.5 shrink-0">
                <BarChart3 className="size-3.5" />
                Median Consistency (avg ± σ)
              </div>
              <div className="flex-1 min-h-0">
                <RangeBarChart leagueId={league.league_id} highlightedRosterIds={activeHighlightIds} mode="median" rosters={rosters} compact />
              </div>
            </div>
            <div className="rounded-lg border border-border/40 bg-card/30 p-3 flex flex-col min-h-0">
              <div className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1.5 shrink-0">
                <BarChart3 className="size-3.5" />
                All-Play Consistency (avg ± σ)
              </div>
              <div className="flex-1 min-h-0">
                <RangeBarChart leagueId={league.league_id} highlightedRosterIds={activeHighlightIds} mode="all_play" rosters={rosters} compact />
              </div>
            </div>
          </div>
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
              <PlayerSearch leagueId={league.league_id} />
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
