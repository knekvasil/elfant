import { useEffect, useState } from 'react'
import { Medal } from 'lucide-react'
import type { Roster, RankingsData } from '../types'
import { cn } from '../lib/utils'
import { fetchRankings } from '../lib/api'
import { Skeleton } from '../components/ui/skeleton'

const rankColors = ['text-yellow-400', 'text-gray-400', 'text-amber-600']

interface Props {
  rosters: Roster[]
  hoveredRosterId?: number | null
  onHover?: (rosterId: number | null) => void
  onClick?: (rosterId: number) => void
  mode?: 'standard' | 'median'
  leagueId?: string
  selectedRosterIds?: Set<number>
}

export default function Standings({ rosters, hoveredRosterId, onHover, onClick, mode = 'standard', leagueId, selectedRosterIds }: Props) {
  const [rankingsData, setRankingsData] = useState<RankingsData | null>(null)
  const [loadingRankings, setLoadingRankings] = useState(false)

  useEffect(() => {
    if (mode !== 'median' || !leagueId) {
      setRankingsData(null)
      return
    }
    setLoadingRankings(true)
    fetchRankings(leagueId, 'median')
      .then(setRankingsData)
      .catch(() => setRankingsData(null))
      .finally(() => setLoadingRankings(false))
  }, [mode, leagueId])

  const sorted = [...rosters].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins
    return b.fpts - a.fpts
  })

  if (mode === 'median' && loadingRankings) {
    return (
      <div className="space-y-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[48px] w-full rounded-md" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2.5 px-3 pb-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        <div className="w-6 flex-shrink-0" />
        <div className="size-8 flex-shrink-0" />
        <div className="flex-1 min-w-0">Team</div>
        <div className="text-right flex-shrink-0 w-14">{mode === 'median' ? 'W-L' : 'Record'}</div>
        <div className="text-right flex-shrink-0 w-16">PF</div>
        <div className="text-right flex-shrink-0 w-14">Diff</div>
      </div>

      {(mode === 'median' && rankingsData ? [...rosters].sort((a, b) => {
        const aR = rankingsData.rosters.find(r => r.roster_id === a.roster_id)
        const bR = rankingsData.rosters.find(r => r.roster_id === b.roster_id)
        const aW = aR?.median_wins ?? 0
        const bW = bR?.median_wins ?? 0
        if (bW !== aW) return bW - aW
        return b.fpts - a.fpts
      }) : sorted).map((r, i) => {
        const diff = r.fpts - r.fpts_against
        const isSelected = selectedRosterIds?.has(r.roster_id) ?? false
        const isHovered = hoveredRosterId === r.roster_id
        const hasSelection = selectedRosterIds != null && selectedRosterIds.size > 0
        const isDimmed = (hoveredRosterId != null && !isHovered) || (hasSelection && !isSelected)

        const rankData = rankingsData?.rosters.find(rd => rd.roster_id === r.roster_id)
        const medianWins = rankData?.median_wins ?? 0
        const totalWeeks = rankData?.total_weeks ?? 0
        const displayRecord = mode === 'median'
          ? `${medianWins}-${totalWeeks - medianWins}`
          : `${r.wins}-${r.losses}${r.ties ? `-${r.ties}` : ''}`

        return (
          <div
            key={r.roster_id}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 rounded-md transition-all duration-200 cursor-pointer',
              isSelected || isHovered ? 'bg-muted/40 ring-1 ring-border' : isDimmed ? 'opacity-30' : 'hover:bg-muted/20',
            )}
            onMouseEnter={() => onHover?.(r.roster_id)}
            onMouseLeave={() => onHover?.(null)}
            onClick={() => onClick?.(r.roster_id)}
          >
            <div className="w-6 flex-shrink-0 text-center">
              {i < 3 ? (
                <Medal className={`size-4 ${rankColors[i]} mx-auto`} />
              ) : (
                <span className="text-xs text-muted-foreground">{i + 1}</span>
              )}
            </div>

            <div className="size-8 rounded-full bg-muted overflow-hidden flex-shrink-0 ring-1 ring-border">
              {r.owner_avatar ? (
                <img src={r.owner_avatar} alt="" className="size-full object-cover" />
              ) : (
                <div className="size-full flex items-center justify-center text-xs font-bold text-muted-foreground">
                  {(r.team_name || r.owner_display || '?').charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{r.team_name || `Team ${r.roster_id}`}</div>
              <div className="text-[10px] text-muted-foreground truncate">{r.owner_display}</div>
            </div>

            <div className="text-sm font-mono tabular-nums text-right flex-shrink-0 w-14">
              {displayRecord}
            </div>

            <div className="text-xs font-mono tabular-nums text-right flex-shrink-0 w-16 text-muted-foreground">
              {r.fpts.toFixed(1)}
            </div>

            <div className={cn(
              'text-xs font-mono tabular-nums text-right flex-shrink-0 w-14',
              diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-red-400' : 'text-muted-foreground',
            )}>
              {diff > 0 ? '+' : ''}{diff.toFixed(1)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
