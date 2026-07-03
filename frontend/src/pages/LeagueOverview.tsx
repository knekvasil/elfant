import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Users, Circle, Trophy, Trash2, Medal } from 'lucide-react'
import { cn } from '../lib/utils'
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
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">{error || 'League not found'}</p>
            <Link to="/"
              className="inline-flex items-center justify-center gap-1.5 text-sm font-medium h-9 px-4 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors mt-4">
              Back
            </Link>
          </CardContent>
        </Card>
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
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>League Home</BreadcrumbPage>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div>
          {data.participants && (
            <LeagueTimeline
              groupId={data.group_id}
              participants={data.participants}
              seasonLinks={seasonLinks}
            />
          )}
        </div>

        <div className="space-y-3">
          {last && (
            <>
              <Card className="border-amber-500/40 ring-1 ring-amber-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy className="size-4 text-amber-400" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reigning Champion</span>
                  </div>
                  {last.champion ? (
                    <div className="flex items-center gap-2">
                      {last.champion_avatar && <img src={last.champion_avatar} alt="" className="size-7 rounded-full" />}
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{last.champion}</div>
                        <div className="text-[10px] text-muted-foreground">{last.champion_owner} · {last.season}</div>
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">TBD</span>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-card/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Trash2 className="size-4 text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Trash King</span>
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
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <div className="space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Season History</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
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
            </CardContent>
          </Card>

          {data.all_time_medals.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Hall of Fame</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
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
              </CardContent>
            </Card>
          )}

          {data.trash_king_medals && data.trash_king_medals.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Trash King Hall of Fame</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
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
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
