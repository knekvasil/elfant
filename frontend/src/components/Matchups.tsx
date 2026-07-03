import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronUp, Swords, Medal } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Card, CardContent } from '../components/ui/card'
import { Skeleton } from '../components/ui/skeleton'
import { fetchMatchups } from '../lib/api'
import type { MatchupEntry } from '../types'

interface Props {
  leagueId: string
  maxWeek: number
  groupId: string
}

const rankColors = ['text-yellow-400', 'text-gray-400', 'text-amber-600']

const positionStyles: Record<string, { bg: string; text: string }> = {
  QB: { bg: 'bg-sky-400/15', text: 'text-sky-300' },
  RB: { bg: 'bg-emerald-400/15', text: 'text-emerald-300' },
  WR: { bg: 'bg-violet-400/15', text: 'text-violet-300' },
  TE: { bg: 'bg-amber-400/15', text: 'text-amber-300' },
  K:  { bg: 'bg-zinc-400/15', text: 'text-zinc-300' },
  DEF:{ bg: 'bg-red-400/15', text: 'text-red-300' },
}
const defaultStyle = { bg: 'bg-zinc-400/10', text: 'text-zinc-300' }

function PlayerRow({ p, reversed, leagueId, groupId }: { p: { name: string; position: string; team: string; points: number; player_img: string | null; team_logo: string | null; player_id?: string }; reversed?: boolean; leagueId?: string; groupId?: string }) {
  const navigate = useNavigate()
  const isDef = p.position === 'DEF'
  const style = positionStyles[p.position] || defaultStyle

  const posBadge = (
    <Badge variant="outline" className={`w-8 text-center justify-center text-[9px] px-0 py-0 h-3.5 leading-none font-semibold flex-shrink-0 ${style.text} ${style.bg} border-current/30`}>
      {p.position || '—'}
    </Badge>
  )

  const avatar = (
    <div className="size-5 rounded-full bg-muted overflow-hidden flex-shrink-0 ring-1 ring-border">
      {isDef && p.team_logo ? (
        <img src={p.team_logo} alt="" className="size-full object-contain p-0.5" />
      ) : p.player_img ? (
        <img src={p.player_img} alt="" className="size-full object-cover" loading="lazy" />
      ) : (
        <div className="size-full flex items-center justify-center">
          <Swords className="size-2.5 text-muted-foreground" />
        </div>
      )}
    </div>
  )

  const ptsAlign = reversed ? 'text-left' : 'text-right'
  const nameAlign = reversed ? 'text-right' : ''
  const nameEl = <span className={`text-xs font-medium truncate flex-1 cursor-pointer hover:text-primary transition-colors ${nameAlign}`}>{p.name}</span>
  const ptsEl = <span className={`text-[11px] font-mono font-medium tabular-nums flex-shrink-0 w-10 ${ptsAlign}`}>{p.points.toFixed(1)}</span>

  const content = <>{posBadge}{avatar}{nameEl}{ptsEl}</>

  if (p.player_id && leagueId) {
    return (
      <button
        onClick={() => navigate(`/league/${groupId}/${leagueId}/player/${p.player_id}`)}
        className={`flex items-center gap-2 py-1.5 px-2 rounded-md w-full text-left ${style.bg} ${reversed ? 'flex-row-reverse' : ''} cursor-pointer hover:brightness-110 transition-all`}
      >
        {content}
      </button>
    )
  }

  return (
    <div className={`flex items-center gap-2 py-1.5 px-2 rounded-md ${style.bg} ${reversed ? 'flex-row-reverse' : ''}`}>
      {content}
    </div>
  )
}

function TeamSide({
  name,
  avatar,
  points,
  result,
  record,
  rank,
  starters,
  side,
  leagueId,
  groupId,
}: {
  name: string
  avatar: string | null
  points: number
  result: string
  record: string
  rank: number
  starters: { name: string; position: string; team: string; points: number; player_img: string | null; team_logo: string | null; player_id?: string }[]
  side: 'left' | 'right'
  leagueId?: string
  groupId?: string
}) {
  const rankMedal = rank <= 3 ? <Medal className={`size-4 ${rankColors[rank - 1]}`} /> : <span className="text-[10px] text-muted-foreground">#{rank}</span>

  const headerContent = (
    <>
      <div className="size-8 rounded-full bg-muted overflow-hidden flex-shrink-0 ring-1 ring-border">
        {avatar ? (
          <img src={avatar} alt="" className="size-full object-cover" />
        ) : (
          <div className="size-full flex items-center justify-center text-xs font-bold text-muted-foreground">
            {name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div className={`min-w-0 flex-1 ${side === 'right' ? 'text-right' : ''}`}>
        <div className={`text-sm font-semibold truncate max-w-[130px] ${side === 'right' ? 'ml-auto' : ''}`}>{name}</div>
        <div className={`flex items-center gap-1 ${side === 'right' ? 'justify-end' : ''}`}>
          {side === 'right' ? (
            <>{rankMedal}<span className="text-[10px] text-muted-foreground">{record}</span></>
          ) : (
            <><span className="text-[10px] text-muted-foreground">{record}</span>{rankMedal}</>
          )}
        </div>
      </div>
      <span className={`text-lg font-bold tabular-nums ${side === 'right' ? 'text-left' : 'text-right'} ${result === 'win' ? 'text-emerald-400' : result === 'loss' ? 'text-red-400' : 'text-muted-foreground'}`}>
        {points.toFixed(2)}
      </span>
    </>
  )

  return (
    <div className={`flex-1 min-w-0 flex flex-col ${side === 'right' ? 'items-end' : ''}`}>
      <div className={`flex items-center gap-2 mb-2.5 w-full ${side === 'right' ? 'flex-row-reverse' : ''}`}>
        {headerContent}
      </div>
      <div className={`w-full space-y-[1.5px] ${side === 'right' ? 'items-end' : ''}`}>
        {starters.map((p, i) => (
          <PlayerRow key={i} p={p} reversed={side === 'right'} leagueId={leagueId} groupId={groupId} />
        ))}
      </div>
    </div>
  )
}

function MatchupCard({ m, leagueId, groupId }: { m: MatchupEntry; leagueId: string; groupId: string }) {
  const [showBench, setShowBench] = useState(false)
  const totalBench = m.bench.length + m.opp_bench.length

  return (
    <Card className="bg-card/50">
      <CardContent className="px-3 pt-3 pb-0 flex flex-col gap-2">
        <div className="flex gap-2">
          <TeamSide
            name={m.team_name}
            avatar={m.team_avatar}
            points={m.points}
            result={m.result}
            record={m.record}
            rank={m.rank}
            starters={m.starters}
            side="left"
            leagueId={leagueId}
            groupId={groupId}
          />

          <div className="flex flex-col items-center justify-center flex-shrink-0">
            <div className="h-full w-px bg-border" />
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider my-1 bg-card px-1">vs</span>
            <div className="h-full w-px bg-border" />
          </div>

          <TeamSide
            name={m.opp_name}
            avatar={m.opp_avatar}
            points={m.opp_points}
            result={m.opp_result}
            record={m.opp_record}
            rank={m.opp_rank}
            starters={m.opp_starters}
            side="right"
            leagueId={leagueId}
            groupId={groupId}
          />
        </div>

        {totalBench > 0 && (
          <div className="flex justify-center pt-1 border-t border-border/50">
            <button
              onClick={() => setShowBench(!showBench)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {showBench ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
              Bench ({totalBench})
            </button>
          </div>
        )}

        {showBench && (
          <div className="flex gap-2 pt-1">
            <div className="flex-1 space-y-[1.5px]">
              {m.bench.length === 0 ? (
                <div className="text-[10px] text-muted-foreground/50 italic text-center">—</div>
              ) : (
                m.bench.map((p, i) => <PlayerRow key={i} p={p} leagueId={leagueId} groupId={groupId} />)
              )}
            </div>
            <div className="flex flex-col items-center justify-center flex-shrink-0">
              <div className="h-full w-px bg-border/50" />
              <span className="text-[8px] font-bold text-muted-foreground/50 uppercase tracking-wider my-0.5 bg-card px-1">BN</span>
              <div className="h-full w-px bg-border/50" />
            </div>
            <div className="flex-1 space-y-[1.5px]">
              {m.opp_bench.length === 0 ? (
                <div className="text-[10px] text-muted-foreground/50 italic text-center">—</div>
              ) : (
                m.opp_bench.map((p, i) => <PlayerRow key={i} p={p} reversed leagueId={leagueId} groupId={groupId} />)
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function Matchups({ leagueId, maxWeek, groupId }: Props) {
  const [week, setWeek] = useState(1)
  const [matchups, setMatchups] = useState<MatchupEntry[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(
    async (w: number) => {
      setLoading(true)
      try {
        const data = await fetchMatchups(leagueId, w)
        setMatchups(data)
      } catch {
        setMatchups([])
      } finally {
        setLoading(false)
      }
    },
    [leagueId]
  )

  useEffect(() => {
    load(week)
  }, [week, load])

  const weeks = Array.from({ length: maxWeek }, (_, i) => i + 1)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {weeks.map((w) => (
          <Button
            key={w}
            variant={w === week ? 'default' : 'outline'}
            size="sm"
            className="size-8 p-0 text-xs"
            onClick={() => setWeek(w)}
          >
            {w}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-52 w-full" />
          ))}
        </div>
      ) : matchups.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-muted-foreground text-sm text-center flex items-center justify-center gap-2">
            <Swords className="size-4" />
            No matchups for week {week}.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {matchups.map((m) => (
            <MatchupCard key={`${m.matchup_id}`} m={m} leagueId={leagueId} groupId={groupId} />
          ))}
        </div>
      )}
    </div>
  )
}
