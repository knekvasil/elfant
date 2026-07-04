import { cn } from '../lib/utils'
import Tooltip from './ui/tooltip'
import type { PlayerCareerSeason, PlayerWeek } from '../types'

const STAT_RULES: [string, string, number][] = [
  ['passing_yards', 'pass_yd', 0.04],
  ['passing_tds', 'pass_td', 4],
  ['passing_interceptions', 'pass_int', -1],
  ['passing_2pt_conversions', 'pass_2pt', 2],
  ['rushing_yards', 'rush_yd', 0.1],
  ['rushing_tds', 'rush_td', 6],
  ['rushing_2pt_conversions', 'rush_2pt', 2],
  ['receptions', 'rec', 1],
  ['receiving_yards', 'rec_yd', 0.1],
  ['receiving_tds', 'rec_td', 6],
  ['receiving_2pt_conversions', 'rec_2pt', 2],
  ['fumbles_lost', 'fum_lost', -2],
  ['def_sacks', 'sack', 1],
  ['def_interceptions', 'int', 2],
  ['def_fumbles_forced', 'ff', 1],
  ['def_tds', 'def_td', 6],
  ['def_safeties', 'safe', 2],
  ['special_teams_tds', 'st_td', 6],
  ['fg_made', 'fgm', 3],
  ['pat_made', 'xpm', 1],
]

const STAT_LABELS: Record<string, string> = {
  passing_yards: 'Pass Yds',
  passing_tds: 'Pass TD',
  passing_interceptions: 'INT',
  passing_2pt_conversions: '2PT',
  rushing_yards: 'Rush Yds',
  rushing_tds: 'Rush TD',
  rushing_2pt_conversions: '2PT',
  receptions: 'Rec',
  receiving_yards: 'Rec Yds',
  receiving_tds: 'Rec TD',
  receiving_2pt_conversions: '2PT',
  fumbles_lost: 'Fum Lost',
  def_sacks: 'Sack',
  def_interceptions: 'INT',
  def_fumbles_forced: 'FF',
  def_tds: 'Def TD',
  def_safeties: 'Safe',
  special_teams_tds: 'ST TD',
  fg_made: 'FG',
  pat_made: 'XP',
}

function weekBreakdown(week: PlayerWeek, rules: Record<string, number>): { label: string; value: string; points: number }[] {
  const result: { label: string; value: string; points: number }[] = []
  for (const [statKey, ruleKey, defaultMult] of STAT_RULES) {
    const val = (week as any)[statKey]
    if (!val) continue
    const mult = rules[ruleKey] ?? defaultMult
    const pts = val * mult
    result.push({ label: STAT_LABELS[statKey] || statKey, value: String(val), points: pts })
  }
  return result
}

interface Props {
  seasons: PlayerCareerSeason[]
  scoringRules?: Record<string, number>
  onHoverSeason?: (season: number | null) => void
}

function cellColor(points: number, min: number, max: number): string {
  if (max === min) return 'bg-yellow-500/30'
  const ratio = (points - min) / (max - min)
  if (ratio > 0.7) return 'bg-emerald-500/50'
  if (ratio > 0.4) return 'bg-yellow-500/35'
  return 'bg-red-500/35'
}

export default function PlayerHeatGrid({ seasons, scoringRules, onHoverSeason }: Props) {
  if (seasons.length === 0) return null

  const sorted = [...seasons].sort((a, b) => b.season - a.season)
  const allPoints = seasons.flatMap((s) => s.weeks.map((w) => w.fantasy_points))
  const min = Math.min(...allPoints)
  const max = Math.max(...allPoints)

  const weekNumbers = [...new Set(seasons.flatMap((s) => s.weeks.map((w) => w.week)))].sort((a, b) => a - b)

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse">
        <thead>
          <tr>
            <th className="text-left text-[8px] text-muted-foreground/40 font-medium pr-1 pb-1" style={{ width: 16 }}>Wk</th>
            {sorted.map((s) => (
              <th
                key={s.season}
                className="text-center text-[8px] text-muted-foreground/40 font-medium pb-1 cursor-pointer hover:text-foreground/60 transition-colors"
                style={{ width: 18, minWidth: 18 }}
                onMouseEnter={() => onHoverSeason?.(s.season)}
                onMouseLeave={() => onHoverSeason?.(null)}
              >
                &apos;{String(s.season).slice(2)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weekNumbers.map((wk) => {
            const hasData = sorted.some((s) => s.weeks.some((w) => w.week === wk))
            if (!hasData) return null

            return (
              <tr key={wk}>
                <td className="text-[8px] text-muted-foreground/40 font-medium pr-1 py-px align-middle" style={{ width: 16 }}>
                  W{wk}
                </td>
                {sorted.map((s) => {
                  const week = s.weeks.find((w) => w.week === wk)
                  const isPost = week?.season_type === 'POST'

                  if (!week) {
                    return (
                      <td key={s.season} className="py-px">
                        <div className="size-4 rounded-sm bg-muted/10" />
                      </td>
                    )
                  }

                  const breakdown = weekBreakdown(week, scoringRules || {})

                  return (
                    <td key={s.season} className="py-px">
                      <Tooltip content={
                        <div className="min-w-[200px]">
                          <div className="text-[11px] font-semibold mb-1.5 text-center">
                            W{wk}{isPost ? ' (POST)' : ''} @ {week.opponent}
                          </div>
                          {breakdown.length > 0 ? (
                            <table className="w-full border-collapse">
                              <tbody>
                                {breakdown.map((b) => (
                                  <tr key={b.label} className="border-b border-border/10 last:border-0">
                                    <td className="py-px pr-3 text-[9px] text-muted-foreground whitespace-nowrap">{b.label}</td>
                                    <td className="py-px text-right text-[9px] tabular-nums text-muted-foreground/60 w-8">{b.value}</td>
                                    <td className={cn('py-px text-right text-[10px] tabular-nums font-medium w-14', b.points < 0 ? 'text-red-400' : 'text-amber-400')}>
                                      {b.points > 0 ? '+' : ''}{b.points.toFixed(1)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="border-t border-border/30">
                                  <td colSpan={2} className="pt-1 text-[10px] font-bold text-right">Total</td>
                                  <td className="pt-1 text-right text-[10px] font-bold tabular-nums text-amber-400">
                                    {week.fantasy_points.toFixed(1)}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          ) : (
                            <div className="text-[10px] text-muted-foreground text-center py-1">No scoring stats</div>
                          )}
                        </div>
                      }>
                        <div
                          className={cn(
                            'size-4 rounded-sm flex items-center justify-center text-[6px] font-bold leading-none',
                            cellColor(week.fantasy_points, min, max),
                            isPost ? 'ring-1 ring-amber-400/50' : '',
                          )}
                        >
                          {week.fantasy_points.toFixed(0)}
                        </div>
                      </Tooltip>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="flex items-center gap-1 mt-2">
        <span className="text-[7px] text-red-400/60">low</span>
        <div className="flex gap-px">
          <div className="size-2 rounded-sm bg-red-500/35" />
          <div className="size-2 rounded-sm bg-yellow-500/35" />
          <div className="size-2 rounded-sm bg-emerald-500/50" />
        </div>
        <span className="text-[7px] text-emerald-400/60">high</span>
        <span className="text-[7px] text-amber-400/60 ml-1.5">⋆ playoff</span>
      </div>
    </div>
  )
}
