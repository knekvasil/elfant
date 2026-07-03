import { useEffect, useState } from 'react'
import { Medal } from 'lucide-react'
import type { Roster, RankingsData, TeamStatsData } from '../types'
import { cn } from '../lib/utils'
import { fetchRankings, fetchTeamStats } from '../lib/api'
import { Skeleton } from '../components/ui/skeleton'

const rankColors = ['text-yellow-400', 'text-gray-400', 'text-amber-600']

export type StandingsMode = 'standard' | 'median' | 'all_play' | 'efficiency'

interface Props {
  rosters: Roster[]
  hoveredRosterId?: number | null
  onHover?: (rosterId: number | null) => void
  onClick?: (rosterId: number) => void
  mode?: StandingsMode
  leagueId?: string
  selectedRosterIds?: Set<number>
  teamStats?: TeamStatsData | null
}

export default function Standings({ rosters, hoveredRosterId, onHover, onClick, mode = 'standard', leagueId, selectedRosterIds, teamStats }: Props) {
  const [rankingsData, setRankingsData] = useState<RankingsData | null>(null)
  const [loadingRankings, setLoadingRankings] = useState(false)
  const [internalTeamStats, setInternalTeamStats] = useState<TeamStatsData | null>(null)

  useEffect(() => {
    if (mode === 'standard' || !leagueId) {
      setRankingsData(null)
      return
    }
    setLoadingRankings(true)
    fetchRankings(leagueId, mode)
      .then(setRankingsData)
      .catch(() => setRankingsData(null))
      .finally(() => setLoadingRankings(false))
  }, [mode, leagueId])

  useEffect(() => {
    if (teamStats || !leagueId) return
    fetchTeamStats(leagueId)
      .then(setInternalTeamStats)
      .catch(() => {})
  }, [leagueId, teamStats])

  const ts = teamStats || internalTeamStats

  const sorted = [...rosters].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins
    return b.fpts - a.fpts
  })

  if (mode !== 'standard' && loadingRankings) {
    return (
      <div className="space-y-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[56px] w-full rounded-md" />
        ))}
      </div>
    )
  }

  const ranked = mode !== 'standard' && rankingsData
    ? [...rosters].sort((a, b) => {
        const aR = rankingsData.rosters.find(r => r.roster_id === a.roster_id)
        const bR = rankingsData.rosters.find(r => r.roster_id === b.roster_id)
        if (!aR || !bR) return b.fpts - a.fpts
        const aKey = mode === 'median' ? aR.median_wins : mode === 'all_play' ? aR.all_play_wins : aR.optimal_wins
        const bKey = mode === 'median' ? bR.median_wins : mode === 'all_play' ? bR.all_play_wins : bR.optimal_wins
        if (bKey !== aKey) return bKey - aKey
        return b.fpts - a.fpts
      })
    : sorted

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 px-2 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        <div className="w-5 flex-shrink-0" />
        <div className="size-7 flex-shrink-0" />
        <div className="flex-1 min-w-0">Team</div>
        {mode === 'all_play' && <div className="text-right flex-shrink-0 w-14">AP-W</div>}
        {mode === 'efficiency' && <div className="text-right flex-shrink-0 w-14">Opt W-L</div>}
        {mode === 'standard' && <div className="text-right flex-shrink-0 w-14">Record</div>}
        {mode === 'median' && <div className="text-right flex-shrink-0 w-14">W-L</div>}
        {mode === 'median' && <div className="text-right flex-shrink-0 w-14">+/-</div>}
        {mode === 'median' && <div className="text-right flex-shrink-0 w-14">σ</div>}
        {mode === 'standard' && <div className="text-right flex-shrink-0 w-16">PF</div>}
        {mode === 'standard' && <div className="text-right flex-shrink-0 w-14">+/-</div>}
        {mode === 'all_play' && <div className="text-right flex-shrink-0 w-14">Avg/W</div>}
        {mode === 'all_play' && <div className="text-right flex-shrink-0 w-14">σ</div>}
        {mode === 'efficiency' && <div className="text-right flex-shrink-0 w-14">+/-</div>}
        {mode === 'efficiency' && <div className="text-right flex-shrink-0 w-14">σ</div>}
        {mode === 'efficiency' && <div className="text-right flex-shrink-0 w-14">Eff%</div>}
      </div>

      {ranked.map((r, i) => {
        const diff = r.fpts - r.fpts_against
        const isHovered = hoveredRosterId === r.roster_id
        const isSelected = selectedRosterIds?.has(r.roster_id) ?? false
        const hasSelection = selectedRosterIds != null && selectedRosterIds.size > 0
        const isDimmed = (hoveredRosterId != null && !isHovered) || (hasSelection && !isSelected)

        const rankData = rankingsData?.rosters.find(rd => rd.roster_id === r.roster_id)
        const medianWins = rankData?.median_wins ?? 0
        const apWins = rankData?.all_play_wins ?? 0
        const optWins = rankData?.optimal_wins ?? 0
        const totalWeeks = rankData?.total_weeks ?? 0

        const displayRecord = mode === 'median'
          ? `${medianWins}-${totalWeeks - medianWins}`
          : mode === 'all_play'
            ? `${apWins}-${totalWeeks * (rosters.length - 1) - apWins}`
            : mode === 'efficiency'
              ? `${optWins}-${totalWeeks - optWins}`
              : `${r.wins}-${r.losses}${r.ties ? `-${r.ties}` : ''}`

        const t = ts?.rosters.find(s => s.roster_id === r.roster_id)
        const eff = rankData?.avg_efficiency ?? 0

        return (
          <div
            key={r.roster_id}
            className={cn(
              'flex items-center gap-2 px-2 py-1.5 rounded-md transition-all duration-200 cursor-pointer',
              isSelected || isHovered ? 'bg-muted/40 ring-1 ring-border' : isDimmed ? 'opacity-30' : 'hover:bg-muted/20',
            )}
            onMouseEnter={() => onHover?.(r.roster_id)}
            onMouseLeave={() => onHover?.(null)}
            onClick={() => onClick?.(r.roster_id)}
          >
            <div className="w-5 flex-shrink-0 text-center">
              {i < 3 ? (
                <Medal className={`size-3.5 ${rankColors[i]} mx-auto`} />
              ) : (
                <span className="text-[10px] text-muted-foreground">{i + 1}</span>
              )}
            </div>

            <div className="size-7 rounded-full bg-muted overflow-hidden flex-shrink-0 ring-1 ring-border">
              {r.owner_avatar ? (
                <img src={r.owner_avatar} alt="" className="size-full object-cover" />
              ) : (
                <div className="size-full flex items-center justify-center text-[9px] font-bold text-muted-foreground">
                  {(r.team_name || r.owner_display || '?').charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold truncate">{r.team_name || `Team ${r.roster_id}`}</div>
              <div className="text-[9px] text-muted-foreground truncate">{r.owner_display}</div>
            </div>

            <div className="text-xs font-semibold tabular-nums text-right flex-shrink-0 w-14">
              {displayRecord}
            </div>

            {mode === 'standard' && (
              <div className="text-[10px] font-mono tabular-nums text-right flex-shrink-0 w-16 text-muted-foreground">
                {r.fpts.toFixed(1)}
              </div>
            )}

            {mode === 'standard' && (
              <div className={cn('text-[10px] font-mono tabular-nums text-right flex-shrink-0 w-14', diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-red-400' : 'text-muted-foreground')}>
                {diff > 0 ? '+' : ''}{diff.toFixed(1)}
              </div>
            )}

            {mode === 'median' && rankData && rankData.pf_diffs.length > 0 && (() => {
              const medDiff = rankData.pf_diffs[rankData.pf_diffs.length - 1]
              return (
                <div className={cn('text-xs font-mono tabular-nums text-right flex-shrink-0 w-14', medDiff > 0 ? 'text-emerald-400' : medDiff < 0 ? 'text-red-400' : 'text-muted-foreground')}>
                  {medDiff > 0 ? '+' : ''}{medDiff.toFixed(1)}
                </div>
              )
            })()}

            {mode === 'median' && t && (
              <div className="text-[10px] font-mono tabular-nums text-right flex-shrink-0 w-14 text-muted-foreground">
                {t.season_std.toFixed(1)}
              </div>
            )}

            {mode === 'all_play' && t && (
              <>
                <div className="text-[10px] font-mono tabular-nums text-right flex-shrink-0 w-14 text-muted-foreground">
                  {(t.all_play_wins / t.weekly.length).toFixed(1)}
                </div>
                <div className="text-[10px] font-mono tabular-nums text-right flex-shrink-0 w-14 text-muted-foreground">
                  {t.season_std.toFixed(1)}
                </div>
              </>
            )}

            {mode === 'efficiency' && (() => {
              const optDiff = optWins - r.wins
              const effVals = t?.weekly.map(w => w.efficiency) || []
              const effN = effVals.length
              const effMean = effVals.reduce((s, v) => s + v, 0) / effN || 0
              const effVar = effVals.reduce((s, v) => s + (v - effMean) ** 2, 0) / effN || 0
              const effStd = Math.sqrt(effVar)
              return (
                <>
                  <div className={cn('text-xs font-mono tabular-nums text-right flex-shrink-0 w-14', optDiff > 0 ? 'text-emerald-400' : optDiff < 0 ? 'text-red-400' : 'text-muted-foreground')}>
                    {optDiff > 0 ? '+' : ''}{optDiff}
                  </div>
                  <div className="text-xs font-mono tabular-nums text-right flex-shrink-0 w-14 text-muted-foreground">
                    {effStd.toFixed(1)}
                  </div>
                  <div className={cn('text-xs font-mono tabular-nums text-right flex-shrink-0 w-14', eff >= 90 ? 'text-emerald-400' : eff >= 80 ? 'text-amber-400' : 'text-red-400')}>
                    {eff.toFixed(0)}%
                  </div>
                </>
              )
            })()}
          </div>
        )
      })}
    </div>
  )
}
