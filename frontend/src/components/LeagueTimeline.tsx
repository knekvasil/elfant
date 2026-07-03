import { Link } from 'react-router-dom'
import { cn } from '../lib/utils'
import type { OwnerParticipant, ParticipantsData } from '../types'

type GroupKey = 'old_guard' | 'newcomers' | 'previously_left'

interface Props {
  groupId: string
  participants: ParticipantsData
}

const groupConfig = {
  old_guard: { label: 'Old Guard', desc: 'Every year since the beginning', color: 'text-emerald-400', dot: 'bg-emerald-500' },
  newcomer: { label: 'Newcomers', desc: 'Joined in later years', color: 'text-amber-400', dot: 'bg-amber-500' },
  previously_left: { label: 'Previously Left', desc: 'No longer in the league', color: 'text-muted-foreground', dot: 'bg-muted-foreground/50' },
}

function TimelineRow({ owner, seasons, groupDot }: { owner: OwnerParticipant; seasons: string[]; groupDot: string }) {
  return (
    <div className="flex items-center gap-1.5 group">
      <div className="flex items-center gap-1.5 w-36 shrink-0 min-w-0">
        {owner.avatar ? (
          <img src={owner.avatar} alt="" className="size-5 rounded-full shrink-0" />
        ) : (
          <div className="size-5 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold shrink-0">
            {owner.display_name?.charAt(0) || '?'}
          </div>
        )}
        <span className="text-xs truncate font-medium">{owner.display_name || 'Unknown'}</span>
      </div>
      <div className="flex items-center gap-1">
        {seasons.map(sy => {
          const p = owner.seasons[sy]
          return (
            <div
              key={sy}
              className={cn(
                'size-5 rounded-sm border border-border/30 flex items-center justify-center transition-colors',
                p?.present ? groupDot : 'bg-transparent'
              )}
              title={p?.present ? `${owner.display_name} · ${sy} · ${p.team_name}` : `${owner.display_name} · ${sy} · absent`}
            >
              {p?.present && <div className="size-2 rounded-full bg-current" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function LeagueTimeline({ groupId, participants }: Props) {
  const seasons = participants.seasons

  return (
    <div className="rounded-lg border border-border/40 bg-card/30 p-4 space-y-4 overflow-x-auto">
      <div className="flex items-center gap-1.5 pl-[148px]">
        {seasons.map(sy => (
          <Link
            key={sy}
            to={`/league/${groupId}/${seasons.length === 1 ? groupId : ''}`}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors size-5 flex items-center justify-center"
          >
            {sy.slice(2)}
          </Link>
        ))}
      </div>

      {(['old_guard', 'newcomers', 'previously_left'] as GroupKey[]).map(key => {
        const group = participants[key]
        const cfg = groupConfig[key === 'newcomers' ? 'newcomer' : key]
        if (group.length === 0) return null
        return (
          <div key={key}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className={cn('text-xs font-semibold', cfg.color)}>{cfg.label}</span>
              <span className="text-[10px] text-muted-foreground">{cfg.desc}</span>
              <span className="text-[10px] text-muted-foreground ml-auto">({group.length})</span>
            </div>
            <div className="space-y-0.5">
              {group.map(o => (
                <TimelineRow key={o.owner_id} owner={o} seasons={seasons} groupDot={cfg.dot} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
