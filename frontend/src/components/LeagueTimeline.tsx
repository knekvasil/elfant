import { Link } from 'react-router-dom'
import { Users } from 'lucide-react'
import { cn } from '../lib/utils'
import Tooltip from '../components/ui/tooltip'
import type { OwnerParticipant, ParticipantsData } from '../types'

interface Props {
  groupId: string
  participants: ParticipantsData
  seasonLinks: Record<string, string>
}

const dotColor: Record<string, string> = {
  old_guard: 'bg-emerald-500',
  newcomer: 'bg-amber-500',
  previously_left: 'bg-muted-foreground/50',
}

function sortedOwners(participants: ParticipantsData): OwnerParticipant[] {
  const all = [
    ...participants.old_guard,
    ...participants.newcomers,
    ...participants.previously_left,
  ]
  all.sort((a, b) => {
    const aFirst = Math.min(...Object.keys(a.seasons).filter(s => a.seasons[s].present).map(Number))
    const bFirst = Math.min(...Object.keys(b.seasons).filter(s => b.seasons[s].present).map(Number))
    return bFirst - aFirst
  })
  return all
}

export default function LeagueTimeline({ groupId, participants, seasonLinks }: Props) {
  const seasons = participants.seasons
  const owners = sortedOwners(participants)

  return (
    <div className="rounded-lg border border-border/40 bg-card/30 p-3 overflow-x-auto">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-2">
        <Users className="size-3.5" />
        Player History
        <span className="text-[10px] font-normal">({owners.length})</span>
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <div className="w-36 shrink-0" />
          <div className="flex items-center gap-1">
            {seasons.map(sy => (
              <Link
                key={sy}
                to={`/league/${groupId}/${seasonLinks[sy] || groupId}`}
                className="text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors size-5 flex items-center justify-center"
              >
                {'\''}{sy.slice(2)}
              </Link>
            ))}
          </div>
        </div>

        {owners.map(o => {
          const group = o.group === 'old_guard' ? 'old_guard' : o.group === 'newcomer' ? 'newcomer' : 'previously_left'
          const dot = dotColor[group]
          return (
            <div key={o.owner_id} className="flex items-center gap-1.5 group">
              <div className="flex items-center gap-1.5 w-36 shrink-0 min-w-0">
                {o.avatar ? (
                  <img src={o.avatar} alt="" className="size-5 rounded-full shrink-0" />
                ) : (
                  <div className="size-5 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold shrink-0">
                    {o.display_name?.charAt(0) || '?'}
                  </div>
                )}
                <span className="text-xs truncate font-medium">{o.display_name || 'Unknown'}</span>
              </div>
              <div className="flex items-center gap-1">
                {seasons.map(sy => {
                  const p = o.seasons[sy]
                  return (
                    <Tooltip key={sy} content={
                      <span>{o.display_name} · {sy} · {p?.present ? p.team_name : 'absent'}</span>
                    }>
                      <div
                        className={cn(
                          'size-5 rounded-sm border border-border/30 flex items-center justify-center transition-colors',
                          p?.present ? dot : 'bg-transparent'
                        )}
                      >
                        {p?.present && <div className="size-2 rounded-full bg-current" />}
                      </div>
                    </Tooltip>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
