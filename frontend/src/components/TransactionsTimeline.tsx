import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeftRight,
  ShoppingCart,
  UserPlus,
  ArrowUp,
  ArrowDown,
  Clock,
  GripVertical,
} from 'lucide-react'
import { Badge } from '../components/ui/badge'
import { Skeleton } from '../components/ui/skeleton'
import { fetchTransactions } from '../lib/api'
import { cn } from '../lib/utils'
import type { TransactionEntry, PlayerMove, RosterBrief } from '../types'

interface Props {
  leagueId: string
}

const typeConfig: Record<string, { icon: typeof ArrowLeftRight; label: string; accent: string; dot: string }> = {
  trade: { icon: ArrowLeftRight, label: 'Trade', accent: 'border-violet-500/30 bg-violet-500/10 text-violet-300', dot: 'bg-violet-400' },
  waiver: { icon: ShoppingCart, label: 'Waiver', accent: 'border-amber-500/30 bg-amber-500/10 text-amber-300', dot: 'bg-amber-400' },
  free_agent: { icon: UserPlus, label: 'Free Agent', accent: 'border-sky-500/30 bg-sky-500/10 text-sky-300', dot: 'bg-sky-400' },
}

function useInView() {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.unobserve(el)
        }
      },
      { threshold: 0.05 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return { ref, inView }
}

function PlayerAvatar({ src, name, size = 'sm' }: { src: string | null | undefined; name: string; size?: 'sm' | 'xs' }) {
  const dims = size === 'xs' ? 'size-5' : 'size-7'
  return (
    <div className={cn(dims, 'rounded-full bg-muted overflow-hidden flex-shrink-0 ring-1 ring-border')}>
      {src ? (
        <img src={src} alt="" className="size-full object-cover" loading="lazy" />
      ) : (
        <div className="size-full flex items-center justify-center text-[9px] font-bold text-muted-foreground">
          {name.charAt(0).toUpperCase()}
        </div>
      )}
    </div>
  )
}

function TeamAvatar({ src, name }: { src: string | null | undefined; name: string }) {
  return (
    <div className="size-5 rounded-full bg-muted overflow-hidden flex-shrink-0 ring-1 ring-border">
      {src ? (
        <img src={src} alt="" className="size-full object-cover" loading="lazy" />
      ) : (
        <div className="size-full flex items-center justify-center text-[7px] font-bold text-muted-foreground">
          {name.charAt(0).toUpperCase()}
        </div>
      )}
    </div>
  )
}

function PositionBadge({ position }: { position: string }) {
  const colorMap: Record<string, string> = {
    QB: 'text-sky-300 border-sky-500/30 bg-sky-500/10',
    RB: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10',
    WR: 'text-amber-300 border-amber-500/30 bg-amber-500/10',
    TE: 'text-orange-300 border-orange-500/30 bg-orange-500/10',
    DEF: 'text-zinc-300 border-zinc-500/30 bg-zinc-500/10',
    K: 'text-red-300 border-red-500/30 bg-red-500/10',
  }
  const style = colorMap[position] || 'text-muted-foreground border-border/50 bg-muted/50'
  return (
    <span className={cn('inline-flex items-center justify-center text-[9px] font-semibold px-1 py-0 h-3.5 rounded border', style)}>
      {position}
    </span>
  )
}

function PlayerMoveRow({ move, action, align }: { move: PlayerMove; action: 'add' | 'drop'; align: 'left' | 'right' }) {
  const Icon = action === 'add' ? ArrowUp : ArrowDown
  const accent = action === 'add' ? 'text-emerald-400' : 'text-red-400'
  const label = action === 'add' ? 'Added' : 'Dropped'
  const isReversed = align === 'right'
  const isDef = move.position === 'DEF'
  return (
    <div className={cn(
      'flex items-center gap-2 py-1.5 px-2 rounded-md transition-colors',
      isReversed ? 'flex-row-reverse' : '',
      action === 'add' ? 'hover:bg-emerald-500/5' : 'hover:bg-red-500/5',
    )}>
      <div className="relative flex-shrink-0">
        {isDef ? (
          <div className="size-7 rounded-full bg-muted overflow-hidden flex-shrink-0 ring-1 ring-border">
            {move.team_logo ? (
              <img src={move.team_logo} alt="" className="size-full object-contain p-0.5" />
            ) : (
              <div className="size-full flex items-center justify-center text-[9px] font-bold text-muted-foreground">
                {move.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        ) : (
          <PlayerAvatar src={move.player_img} name={move.name} />
        )}
        <div className={cn('absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full flex items-center justify-center ring-1 ring-background', action === 'add' ? 'bg-emerald-500/20' : 'bg-red-500/20')}>
          <Icon className={cn('size-2', accent)} />
        </div>
      </div>
      <div className={cn('flex-1 min-w-0', isReversed ? 'text-right' : '')}>
        <div className={cn('flex items-center gap-1.5 flex-wrap', isReversed ? 'flex-row-reverse' : '')}>
          <span className="text-xs font-medium truncate">{move.name}</span>
          <PositionBadge position={move.position} />
          {!isDef && move.team && (
            <div className={cn('flex items-center gap-1', isReversed ? 'flex-row-reverse' : '')}>
              {move.team_logo && <img src={move.team_logo} alt="" className="size-3 rounded-full object-contain" />}
              <span className="text-[9px] font-mono font-medium text-muted-foreground">{move.team}</span>
            </div>
          )}
        </div>
        <span className={cn('text-[9px] font-medium', accent)}>{label}</span>
      </div>
    </div>
  )
}

function RosterGroup({ roster, adds, drops, align }: { roster: RosterBrief; adds: PlayerMove[]; drops: PlayerMove[]; align: 'left' | 'right' }) {
  const isReversed = align === 'right'
  return (
    <div className="space-y-0.5">
      <div className={cn('flex items-center gap-1.5 px-2 py-1', isReversed ? 'flex-row-reverse' : '')}>
        <TeamAvatar src={roster.owner_avatar} name={roster.team_name} />
        <span className="text-[11px] font-semibold truncate text-foreground/90">{roster.team_name}</span>
      </div>
      <div className={cn(
        isReversed ? 'mr-4 border-r pr-2' : 'ml-4 border-l pl-2',
        'space-y-0.5',
      )}>
        {adds.map((m, i) => (
          <PlayerMoveRow key={`add-${m.player_id}-${i}`} move={m} action="add" align={align} />
        ))}
        {drops.map((m, i) => (
          <PlayerMoveRow key={`drop-${m.player_id}-${i}`} move={m} action="drop" align={align} />
        ))}
      </div>
    </div>
  )
}

type Side = 'left' | 'right'

function DateBadge({ timestamp, side }: { timestamp: number; side: Side }) {
  const d = new Date(timestamp)
  return (
    <div className={cn('flex flex-col', side === 'left' ? 'items-end' : 'items-start')}>
      <span className="text-xs font-semibold tabular-nums leading-none">
        {d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
      </span>
      <span className="text-[10px] text-muted-foreground/50 mt-0.5">
        {d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  )
}

function TransactionCard({ txn, side }: { txn: TransactionEntry; side: Side }) {
  const cfg = typeConfig[txn.type] || typeConfig.free_agent
  const Icon = cfg.icon
  const isPending = txn.status !== 'complete'
  const isOnLeft = side === 'left'
  const borderRadius = isOnLeft ? 'rounded-r-xl' : 'rounded-l-xl'
  const align: 'left' | 'right' = isOnLeft ? 'right' : 'left'
  const waiverBid = txn.type === 'waiver' && txn.player_adds.length > 0 ? txn.player_adds[0].waiver_bid : null

  return (
    <div className={cn('border border-border/40 bg-card/50 overflow-hidden transition-colors', borderRadius)}>
      {/* Accent header */}
      <div className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 border-b border-border/20',
        isOnLeft ? 'flex-row-reverse' : '',
        cfg.accent.replace('border-', 'bg-opacity-5 '),
      )}>
        <div className={cn('size-5 rounded-full flex items-center justify-center', cfg.accent.split(' ').slice(1).join(' '))}>
          <Icon className="size-2.5" />
        </div>
        <span className={cn('text-[10px] font-semibold', cfg.accent.split(' ')[2] || 'text-muted-foreground')}>{cfg.label}</span>
        {isPending && (
          <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 border-red-500/30 bg-red-500/10 text-red-300 font-medium flex items-center gap-0.5">
            <Clock className="size-2" />
            {txn.status}
          </Badge>
        )}
        {waiverBid != null && (
          <span className={cn('text-[10px] font-mono font-semibold text-amber-400', isOnLeft ? 'mr-auto' : 'ml-auto')}>${waiverBid}</span>
        )}
      </div>

      {/* Card body */}
      <div className={cn('p-2', isOnLeft ? 'text-right' : '')}>
        {txn.type === 'trade' ? (
          <div className="divide-y divide-border/20">
            {txn.involved_rosters.map((roster) => {
              const rosterAdds = txn.player_adds.filter((m) => m.roster_id === roster.roster_id)
              const rosterDrops = txn.player_drops.filter((m) => m.roster_id === roster.roster_id)
              if (rosterAdds.length === 0 && rosterDrops.length === 0) return null
              return (
                <div key={roster.roster_id} className="py-1 first:pt-0 last:pb-0">
                  <RosterGroup roster={roster} adds={rosterAdds} drops={rosterDrops} align={align} />
                </div>
              )
            })}
            {(txn.draft_picks.length > 0 || txn.waiver_budget.length > 0) && (
              <div className={cn('pt-1.5 space-y-0.5', isOnLeft ? 'pr-2' : 'px-2')}>
                {txn.draft_picks.map((dp, i) => (
                  <div key={i} className={cn('flex items-center gap-1.5 text-[10px] text-muted-foreground', isOnLeft ? 'flex-row-reverse' : '')}>
                    <GripVertical className="size-2.5 text-muted-foreground/40" />
                    {dp}
                  </div>
                ))}
                {txn.waiver_budget.map((wb, i) => (
                  <div key={i} className={cn('flex items-center gap-1.5 text-[10px] text-muted-foreground', isOnLeft ? 'flex-row-reverse' : '')}>
                    <GripVertical className="size-2.5 text-muted-foreground/40" />
                    Roster {wb.sender} sends ${wb.amount} FAAB to Roster {wb.receiver}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            {txn.involved_rosters.map((roster) => {
              const rosterAdds = txn.player_adds.filter((m) => m.roster_id === roster.roster_id)
              const rosterDrops = txn.player_drops.filter((m) => m.roster_id === roster.roster_id)
              if (rosterAdds.length === 0 && rosterDrops.length === 0) return null
              return (
                <RosterGroup key={roster.roster_id} roster={roster} adds={rosterAdds} drops={rosterDrops} align={align} />
              )
            })}
            {txn.involved_rosters.length === 0 && (
              <div className="space-y-0.5">
                {txn.player_adds.map((m, i) => (
                  <PlayerMoveRow key={`add-${m.player_id}-${i}`} move={m} action="add" align={align} />
                ))}
                {txn.player_drops.map((m, i) => (
                  <PlayerMoveRow key={`drop-${m.player_id}-${i}`} move={m} action="drop" align={align} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function TimelineEvent({ txn, sideIdx, weekIdx }: { txn: TransactionEntry; sideIdx: number; weekIdx: number }) {
  const side: Side = sideIdx % 2 === 0 ? 'left' : 'right'
  const { ref, inView } = useInView()
  const cfg = typeConfig[txn.type] || typeConfig.free_agent

  return (
    <div
      ref={ref}
      className={cn(
        'flex items-start gap-4 md:gap-8 transition-all duration-300 ease-out',
        side === 'left' ? 'flex-row' : 'flex-row-reverse',
        inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3',
      )}
      style={{ transitionDelay: `${weekIdx * 30}ms` }}
    >
      {/* Card side */}
      <div className="flex-1 min-w-0 md:w-1/2">
        <TransactionCard txn={txn} side={side} />
      </div>

      {/* Center dot */}
      <div className="relative flex flex-col items-center flex-shrink-0 pt-1">
        <div className={cn('size-3 rounded-full ring-2 ring-background', cfg.dot)} />
      </div>

      {/* Date side */}
      <div className="flex-1 md:w-1/2 pt-1">
        <DateBadge timestamp={txn.created} side={side === 'left' ? 'right' : 'left'} />
      </div>
    </div>
  )
}

export default function TransactionsTimeline({ leagueId }: Props) {
  const [data, setData] = useState<TransactionEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchTransactions(leagueId)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [leagueId])

  if (loading) return <Skeleton className="h-48 w-full" />
  if (data.length === 0) return <p className="text-muted-foreground text-sm text-center py-8">No transactions found.</p>

  const byLeg = new Map<number, TransactionEntry[]>()
  for (const t of data) {
    const leg = t.leg || 0
    if (!byLeg.has(leg)) byLeg.set(leg, [])
    byLeg.get(leg)!.push(t)
  }
  const legs = [...byLeg.keys()].sort((a, b) => b - a)

  let sideCounter = 0

  return (
    <div className="relative">
      <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-border/40 via-border/30 to-transparent -translate-x-px pointer-events-none" />

      {legs.map((leg) => {
        const txns = byLeg.get(leg)!
        return (
          <div key={leg} className="relative pb-8 last:pb-0">
            <div className="sticky top-0 z-10 py-2.5 bg-background/80 backdrop-blur-sm mb-6">
              <div className="flex items-center justify-center gap-3">
                <span className="h-px flex-1 bg-border/20 max-w-16" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.2em]">Week {leg}</span>
                <span className="h-px flex-1 bg-border/20 max-w-16" />
              </div>
            </div>

            <div className="relative space-y-6 md:space-y-8">
              {txns.map((t, i) => {
                const idx = sideCounter++
                return <TimelineEvent key={`${t.created}-${i}`} txn={t} sideIdx={idx} weekIdx={i} />
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
