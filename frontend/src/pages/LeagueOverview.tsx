import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Trophy, Users, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
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
import { fetchLeagueOverview } from '../lib/api'
import type { LeagueOverviewData } from '../types'

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

  const statusBadge = (status: string) => {
    const color =
      status === 'complete'
        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
        : status === 'in_season'
          ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
          : 'border-blue-500/30 bg-blue-500/10 text-blue-400'
    const label = status === 'in_season' ? 'Live' : status === 'complete' ? 'Done' : status
    return <Badge variant="outline" className={color}>{label}</Badge>
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
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
    <div className="max-w-4xl mx-auto p-4 space-y-6">
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
        <p className="text-muted-foreground text-sm mt-1 flex items-center gap-1.5">
          <Users className="size-3.5" />
          {data.total_seasons} {data.total_seasons === 1 ? 'season' : 'seasons'}
          {data.total_teams > 0 && ` · ${data.total_teams} teams per year`}
        </p>
      </div>

      <div className="space-y-3">
        {data.seasons.map(s => (
          <Card key={s.league_id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">{s.season}</CardTitle>
                  {statusBadge(s.status)}
                  <span className="text-sm text-muted-foreground">{s.total_rosters} teams</span>
                </div>
                <Link
                  to={`/league/${data.group_id}/${s.league_id}`}
                  className="inline-flex items-center text-sm font-medium h-8 px-3 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  View Season
                  <ChevronRight className="size-3.5 ml-1" />
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <Trophy className="size-4 text-amber-400 shrink-0" />
                  {s.champion ? (
                    <div className="flex items-center gap-1.5 min-w-0">
                      {s.champion_avatar && (
                        <img src={s.champion_avatar} alt="" className="size-5 rounded-full shrink-0" />
                      )}
                      <span className="font-medium truncate">{s.champion}</span>
                      {s.champion_owner && (
                        <span className="text-muted-foreground truncate">({s.champion_owner})</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground italic">
                      {s.status === 'complete' ? 'Champion —' : 'Season in progress'}
                    </span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground flex items-center gap-1.5">
                  {s.runner_up && (
                    <>
                      <span className="shrink-0">Runner-up:</span>
                      <span className="truncate">{s.runner_up}</span>
                      {s.runner_up_owner && <span className="truncate">({s.runner_up_owner})</span>}
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
