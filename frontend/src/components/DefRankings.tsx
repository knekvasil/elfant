import type { PlayerDefense, PlayerDefRanking } from '../types'

interface Props {
  defense: PlayerDefense
  rankings: PlayerDefRanking
}

const RANK_LABELS: [keyof PlayerDefRanking, string][] = [
  ['sacks', 'Sacks'],
  ['interceptions', 'INT'],
  ['tackles', 'Tackles'],
  ['tackles_for_loss', 'TFL'],
  ['passes_defended', 'PD'],
  ['fumbles_forced', 'FF'],
  ['fumble_recoveries', 'Fum Rec'],
  ['defensive_tds', 'Def TD'],
  ['safeties', 'Safeties'],
  ['fourth_down_stops', '4th Stop'],
  ['three_and_outs', '3&Out'],
  ['kicks_blocked', 'Blk Kick'],
  ['pts_allowed', 'Pts/g'],
  ['yds_allowed', 'Yds/g'],
  ['time_of_possession', 'TOP/g'],
  ['plays_per_game', 'Plays/g'],
]

const STAT_VALUES: Record<keyof PlayerDefRanking, (d: PlayerDefense) => string> = {
  sacks: (d) => String(d.sacks),
  interceptions: (d) => String(d.interceptions),
  tackles: (d) => String(d.tackles),
  tackles_for_loss: (d) => String(d.tackles_for_loss),
  passes_defended: (d) => String(d.passes_defended),
  fumbles_forced: (d) => String(d.fumbles_forced),
  fumble_recoveries: (d) => String(d.fumble_recoveries),
  defensive_tds: (d) => String(d.defensive_tds),
  safeties: (d) => String(d.safeties),
  fourth_down_stops: (d) => String(d.fourth_down_stops),
  three_and_outs: (d) => String(d.three_and_outs),
  kicks_blocked: (d) => String(d.kicks_blocked),
  pts_allowed: (d) => d.pts_allowed_avg.toFixed(1),
  yds_allowed: (d) => d.yds_allowed_avg.toFixed(0),
  time_of_possession: (d) => `${d.time_of_possession_avg.toFixed(1)}m`,
  plays_per_game: (d) => d.plays_per_game.toFixed(0),
}

export default function DefRankings({ defense, rankings }: Props) {
  return (
    <div className="space-y-0.5">
      {RANK_LABELS.map(([key, label]) => {
        const rank = rankings[key]
        const value = STAT_VALUES[key](defense)
        const hue = 120 - ((rank - 1) / 31) * 120
        return (
          <div key={key} className="flex items-center gap-2 text-[10px]">
            <span className="w-16 shrink-0 text-right font-semibold tabular-nums" style={{ color: `hsl(${hue}, 75%, 45%)` }}>
              #{rank}
            </span>
            <div className="flex-1 h-4 rounded-sm bg-muted/20 overflow-hidden relative">
              <div
                className="h-full rounded-sm transition-all"
                style={{
                  width: `${((32 - rank) / 31) * 100}%`,
                  backgroundColor: `hsl(${hue}, 55%, 35%)`,
                }}
              />
            </div>
            <span className="w-12 shrink-0 text-muted-foreground text-right tabular-nums">{value}</span>
            <span className="w-16 shrink-0 text-muted-foreground/50">{label}</span>
          </div>
        )
      })}
      <div className="flex items-center gap-2 mt-1.5 text-[8px] text-muted-foreground/50">
        <span className="w-16 shrink-0 text-right">#1</span>
        <div className="flex-1 flex gap-px">
          <div className="flex-1 h-1 rounded-full" style={{ background: 'linear-gradient(to right, hsl(120,55%,35%), hsl(0,55%,35%))' }} />
        </div>
        <span className="w-12 shrink-0 text-right">#32</span>
        <span className="w-16 shrink-0">NFL Rank</span>
      </div>
    </div>
  )
}
