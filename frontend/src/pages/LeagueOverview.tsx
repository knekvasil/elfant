import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Trophy, Users, Circle } from 'lucide-react'
import { cn } from '../lib/utils'
import { Card, CardContent } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Skeleton } from '../components/ui/skeleton'
import {
  BreadcrumbRoot,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '../components/ui/breadcrumb'
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
  status === 'in_season' ? 'Live' : status === 'complete' ? 'Done' : status

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
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">{error || 'League not found'}</p>
            <Link to="/" className="inline-flex items-center justify-center gap-1.5 text-sm font-medium h-9 px-4 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors mt-4">
              Back
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-5">
      <BreadcrumbRoot>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{data.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </BreadcrumbRoot>

      <div>
        <h1 className="text-2xl font-bold">{data.name}</h1>
        <p className="text-muted-foreground text-sm mt-0.5 flex items-center gap-1.5">
          <Users className="size-3.5" />
          {data.total_seasons} {data.total_seasons === 1 ? 'season' : 'seasons'}
          {data.total_teams > 0 && ` · ${data.total_teams} teams per year`}
        </p>
      </div>

      {data.participants && (
        <LeagueTimeline groupId={data.group_id} participants={data.participants} />
      )}

      <div className="space-y-1">
        {data.seasons.map(s => (
          <Link
            key={s.league_id}
            to={`/league/${data.group_id}/${s.league_id}`}
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent/30 transition-colors group"
          >
            <Circle className={cn('size-2.5 shrink-0 fill-current', statusStyle(s.status).dot)} />
            <span className="text-sm font-semibold w-10 shrink-0">{s.season}</span>
            <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 h-5', statusStyle(s.status).badge)}>
              {statusLabel(s.status)}
            </Badge>
            <span className="text-xs text-muted-foreground w-16 shrink-0">{s.total_rosters} teams</span>
            {s.champion ? (
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <Trophy className="size-3 text-amber-400 shrink-0" />
                {s.champion_avatar && (
                  <img src={s.champion_avatar} alt="" className="size-4 rounded-full shrink-0" />
                )}
                <span className="text-xs font-medium truncate">{s.champion}</span>
                {s.champion_owner && (
                  <span className="text-[10px] text-muted-foreground truncate hidden sm:inline">({s.champion_owner})</span>
                )}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground italic flex-1">
                {s.status === 'complete' ? 'Champion —' : 'In progress'}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
