import { Medal } from 'lucide-react'
import type { Roster } from '../types'

const rankColors = ['text-yellow-400', 'text-gray-400', 'text-amber-600']

interface Props {
  rosters: Roster[]
  hoveredRosterId?: number | null
  onHover?: (rosterId: number | null) => void
  onClick?: (rosterId: number) => void
}

export default function Standings({ rosters, hoveredRosterId, onHover, onClick }: Props) {
  const sorted = [...rosters].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins
    return b.fpts - a.fpts
  })

  return (
    <div className="space-y-1">
      {/* Column headers */}
      <div className="flex items-center gap-2.5 px-3 pb-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        <div className="w-6 flex-shrink-0" />
        <div className="size-8 flex-shrink-0" />
        <div className="flex-1 min-w-0">Team</div>
        <div className="text-right flex-shrink-0 w-14">Record</div>
        <div className="text-right flex-shrink-0 w-16">PF</div>
        <div className="text-right flex-shrink-0 w-14">Diff</div>
      </div>

      {sorted.map((r, i) => {
        const record = `${r.wins}-${r.losses}${r.ties ? `-${r.ties}` : ''}`
        const diff = r.fpts - r.fpts_against
        const isHovered = hoveredRosterId === r.roster_id
        const isDimmed = hoveredRosterId != null && !isHovered
        return (
          <div
            key={r.roster_id}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-md transition-all duration-200 cursor-pointer
              ${isHovered ? 'bg-muted/40 ring-1 ring-border' : isDimmed ? 'opacity-30' : 'hover:bg-muted/20'}`}
            onMouseEnter={() => onHover?.(r.roster_id)}
            onMouseLeave={() => onHover?.(null)}
            onClick={() => onClick?.(r.roster_id)}
          >
            {/* Rank */}
            <div className="w-6 flex-shrink-0 text-center">
              {i < 3 ? (
                <Medal className={`size-4 ${rankColors[i]} mx-auto`} />
              ) : (
                <span className="text-xs text-muted-foreground">{i + 1}</span>
              )}
            </div>

            {/* Avatar */}
            <div className="size-8 rounded-full bg-muted overflow-hidden flex-shrink-0 ring-1 ring-border">
              {r.owner_avatar ? (
                <img src={r.owner_avatar} alt="" className="size-full object-cover" />
              ) : (
                <div className="size-full flex items-center justify-center text-xs font-bold text-muted-foreground">
                  {(r.team_name || r.owner_display || '?').charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Team + Owner */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{r.team_name || `Team ${r.roster_id}`}</div>
              <div className="text-[10px] text-muted-foreground truncate">{r.owner_display}</div>
            </div>

            {/* Record */}
            <div className="text-sm font-mono tabular-nums text-right flex-shrink-0 w-14">
              {record}
            </div>

            {/* PF */}
            <div className="text-xs font-mono tabular-nums text-right flex-shrink-0 w-16 text-muted-foreground">
              {r.fpts.toFixed(1)}
            </div>

            {/* Diff */}
            <div className={`text-xs font-mono tabular-nums text-right flex-shrink-0 w-14 ${diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
              {diff > 0 ? '+' : ''}{diff.toFixed(1)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
