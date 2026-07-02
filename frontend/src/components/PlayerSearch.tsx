import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ChevronRight, UserCheck, UserX } from 'lucide-react'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { Skeleton } from '../components/ui/skeleton'
import { cn } from '../lib/utils'
import { fetchPlayerStats } from '../lib/api'
import type { PlayerStats } from '../types'

interface Props {
  leagueId: string
}

const POSITIONS = ['All', 'QB', 'RB', 'WR', 'TE', 'K', 'DEF'] as const
const posColors: Record<string, string> = {
  QB: 'text-sky-300 border-sky-500/30 bg-sky-500/10',
  RB: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10',
  WR: 'text-amber-300 border-amber-500/30 bg-amber-500/10',
  TE: 'text-orange-300 border-orange-500/30 bg-orange-500/10',
  DEF: 'text-zinc-300 border-zinc-500/30 bg-zinc-500/10',
  K: 'text-red-300 border-red-500/30 bg-red-500/10',
}

export default function PlayerSearch({ leagueId }: Props) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [position, setPosition] = useState('All')
  const [owned, setOwned] = useState<'all' | 'owned' | 'free'>('all')
  const [sort, setSort] = useState('total')
  const [players, setPlayers] = useState<PlayerStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setLoading(true)
    fetchPlayerStats(leagueId, {
      position: position === 'All' ? undefined : position,
      search: debouncedSearch || undefined,
      owned: owned === 'all' ? undefined : owned === 'owned',
      sort,
    })
      .then((data) => setPlayers(data.players || []))
      .catch(() => setPlayers([]))
      .finally(() => setLoading(false))
  }, [leagueId, debouncedSearch, position, owned, sort])

  return (
    <div className="space-y-3">
      <div className="space-y-2.5 sticky top-0 bg-card z-10 pb-2 -mx-1 px-1">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search players..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {POSITIONS.map((p) => (
            <button
              key={p}
              onClick={() => setPosition(p)}
              className={cn(
                'text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-colors',
                position === p
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/30 text-muted-foreground border-border/40 hover:bg-muted/60',
              )}
            >
              {p === 'All' ? 'All' : p}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1">
            {(['all', 'owned', 'free'] as const).map((o) => (
              <button
                key={o}
                onClick={() => setOwned(o)}
                className={cn(
                  'text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-colors',
                  owned === o
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted/30 text-muted-foreground border-border/40 hover:bg-muted/60',
                )}
              >
                {o === 'all' ? 'All' : o === 'owned' ? 'Owned' : 'Free'}
              </button>
            ))}
          </div>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="text-[10px] bg-muted/30 border border-border/40 rounded-full px-2.5 py-1 text-muted-foreground font-semibold outline-none"
          >
            <option value="total">Total Pts</option>
            <option value="avg">Avg Pts</option>
            <option value="name">Name</option>
          </select>
        </div>
      </div>

      <div className="space-y-1">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[60px] w-full rounded-lg" />
          ))
        ) : players.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">No players found</p>
        ) : (
          players.map((p) => (
            <button
              key={p.player_id}
              onClick={() => navigate(`/league/${leagueId}/player/${p.player_id}`)}
              className="w-full text-left rounded-lg border border-border/40 bg-card/30 hover:bg-card/60 transition-colors p-3 relative"
            >
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-full bg-muted overflow-hidden flex-shrink-0 ring-1 ring-border">
                  {p.position === 'DEF' && p.team_logo ? (
                    <img src={p.team_logo} alt="" className="size-full object-contain p-0.5" />
                  ) : p.player_img ? (
                    <img src={p.player_img} alt="" className="size-full object-cover" loading="lazy" />
                  ) : (
                    <div className="size-full flex items-center justify-center text-xs font-bold text-muted-foreground">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold truncate">{p.name}</span>
                    <Badge variant="outline" className={cn('text-[9px] px-1 py-0 h-3.5 font-semibold', posColors[p.position] || '')}>
                      {p.position}
                    </Badge>
                    {p.team && (
                      <div className="flex items-center gap-0.5">
                        {p.team_logo && <img src={p.team_logo} alt="" className="size-3 rounded-full object-contain" />}
                        <span className="text-[9px] font-mono font-medium text-muted-foreground">{p.team}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-0.5 ml-auto">
                      {p.owned ? (
                        <UserCheck className="size-3 text-emerald-400" />
                      ) : (
                        <UserX className="size-3 text-muted-foreground/40" />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {p.overall_rank != null && (
                      <span className="text-[9px] text-muted-foreground/70 font-medium">#{p.overall_rank} Overall</span>
                    )}
                    {p.position_rank != null && (
                      <span className="text-[9px] text-muted-foreground/70 font-medium">#{p.position_rank} {p.position}</span>
                    )}
                  </div>
                </div>

                <div className="text-right flex-shrink-0 space-y-0.5">
                  <div className="text-sm font-semibold tabular-nums">{p.total_points.toFixed(1)}</div>
                  <div className="text-[10px] text-muted-foreground/60 tabular-nums">
                    {p.avg_points.toFixed(1)} avg &middot; {p.games}g
                  </div>
                </div>

                <ChevronRight className="size-4 text-muted-foreground/30 flex-shrink-0" />
              </div>
            </button>
          ))
        )}

        {!loading && players.length > 0 && (
          <p className="text-[10px] text-muted-foreground/50 text-center pt-1">
            {players.length} player{players.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  )
}
