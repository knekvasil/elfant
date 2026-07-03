import type { TeamStatsData, Roster } from '../types'

interface Props {
  teamStats: TeamStatsData
  rosters: Roster[]
  hoveredRosterId?: number | null
  onHover?: (rosterId: number | null) => void
  onClick?: (rosterId: number) => void
  highlightedRosterIds?: Set<number>
}

const TEAM_COLORS = [
  '#38bdf8', '#f472b6', '#a78bfa', '#34d399', '#fbbf24',
  '#fb923c', '#f87171', '#2dd4bf', '#818cf8', '#c084fc',
  '#4ade80', '#fde68a',
]

const W = 300
const H = 280
const PAD = { top: 18, right: 16, bottom: 28, left: 38 }
const innerW = W - PAD.left - PAD.right
const innerH = H - PAD.top - PAD.bottom

interface PlotDef {
  key: string
  title: string
  question: string
  description: string
  paragraph: string
  xLabel: string
  yLabel: string
  quads: [string, string, string, string]
  x: (r: TeamStatsData['rosters'][0], roster: Roster | undefined, weeks: number) => number
  y: (r: TeamStatsData['rosters'][0], roster: Roster | undefined, weeks: number) => number
}

function ScatterPlot({
  def,
  data,
  rosters,
  weeks,
  rosterColorMap,
  hoveredRosterId,
  onHover,
  onClick,
  highlightedRosterIds,
}: {
  def: PlotDef
  data: TeamStatsData['rosters']
  rosters: Roster[]
  weeks: number
  rosterColorMap: Map<number, string>
  hoveredRosterId?: number | null
  onHover?: (rosterId: number | null) => void
  onClick?: (rosterId: number) => void
  highlightedRosterIds?: Set<number>
}) {
  const hasActive = highlightedRosterIds !== undefined && highlightedRosterIds.size > 0
  const isHighlighted = (rid: number) => highlightedRosterIds?.has(rid) ?? false
  const isDimmed = (rid: number) => hasActive && !isHighlighted(rid)

  const points = data.map((r) => {
    const roster = rosters.find(ro => ro.roster_id === r.roster_id)
    return {
      roster_id: r.roster_id,
      x: def.x(r, roster, weeks),
      y: def.y(r, roster, weeks),
      avatar: roster?.owner_avatar,
      teamName: roster?.team_name || r.name,
      ownerName: roster?.owner_display || '',
    }
  })

  const allX = points.map(p => p.x)
  const allY = points.map(p => p.y)
  const xMid = [...allX].sort((a, b) => a - b)[Math.floor(allX.length / 2)]
  const yMid = [...allY].sort((a, b) => a - b)[Math.floor(allY.length / 2)]
  const xMin = Math.min(...allX)
  const xMax = Math.max(...allX)
  const yMin = Math.min(...allY)
  const yMax = Math.max(...allY)
  const xRange = xMax - xMin || 1
  const yRange = yMax - yMin || 1

  const xPad = xRange * 0.08
  const yPad = yRange * 0.08
  const sxMin = xMin - xPad
  const sxMax = xMax + xPad
  const syMin = yMin - yPad
  const syMax = yMax + yPad
  const sxRange = sxMax - sxMin || 1
  const syRange = syMax - syMin || 1

  const sx = (v: number) => PAD.left + ((v - sxMin) / sxRange) * innerW
  const sy = (v: number) => PAD.top + (1 - (v - syMin) / syRange) * innerH

  const avatarR = 10

  const hoveredPoint = hoveredRosterId != null ? points.find(p => p.roster_id === hoveredRosterId) : null

  return (
    <div className="rounded-lg border border-border/40 bg-card/30 p-3 flex flex-col min-h-0">
      <div className="text-[10px] font-semibold text-muted-foreground mb-0.5 shrink-0">
        {def.question}
      </div>
      <div className="text-[8px] text-muted-foreground/60 leading-tight mb-1.5 shrink-0">
        {def.paragraph}
      </div>
      <div className="flex-1 min-h-0">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full">
          <line x1={sx(xMid)} y1={PAD.top} x2={sx(xMid)} y2={PAD.top + innerH} stroke="currentColor" className="text-foreground/20" strokeWidth={0.5} strokeDasharray="3 2" />
          <line x1={PAD.left} y1={sy(yMid)} x2={PAD.left + innerW} y2={sy(yMid)} stroke="currentColor" className="text-foreground/20" strokeWidth={0.5} strokeDasharray="3 2" />
          <rect x={PAD.left} y={PAD.top} width={innerW} height={innerH} fill="none" stroke="currentColor" className="text-foreground/15" strokeWidth={0.5} />
          {points.map((p) => {
            const cx = sx(p.x)
            const cy = sy(p.y)
            const hl = isHighlighted(p.roster_id)
            const dm = isDimmed(p.roster_id)
            const color = rosterColorMap.get(p.roster_id)
            const isHovered = hoveredRosterId === p.roster_id
            const dim = dm ? 0.08 : hl || isHovered ? 1 : 0.75
            return (
              <g
                key={p.roster_id}
                opacity={dim}
                className="transition-all duration-200 cursor-pointer"
                onMouseEnter={() => onHover?.(p.roster_id)}
                onMouseLeave={() => onHover?.(null)}
                onClick={() => onClick?.(p.roster_id)}
              >
                {p.avatar ? (
                  <>
                    <circle cx={cx} cy={cy} r={avatarR + 1} fill="none" stroke={color} strokeWidth={hl ? 2 : 1} className="transition-all duration-200" />
                    <clipPath id={`clip-${def.key}-${p.roster_id}`}>
                      <circle cx={cx} cy={cy} r={avatarR} />
                    </clipPath>
                    <image href={p.avatar} x={cx - avatarR} y={cy - avatarR} width={avatarR * 2} height={avatarR * 2} clipPath={`url(#clip-${def.key}-${p.roster_id})`} />
                  </>
                ) : (
                  <circle cx={cx} cy={cy} r={hl ? avatarR + 1 : avatarR - 1} fill={color} stroke="currentColor" strokeWidth={hl ? 2 : 1} className="text-background transition-all duration-200" />
                )}
              </g>
            )
          })}
          <text x={PAD.left + innerW / 2} y={H - 4} textAnchor="middle" className="fill-foreground/70" fontSize="8" fontFamily="monospace" fontWeight="600">{def.xLabel}</text>
          <text x={10} y={PAD.top + innerH / 2} textAnchor="middle" className="fill-foreground/70" fontSize="8" fontFamily="monospace" fontWeight="600" transform={`rotate(-90, 10, ${PAD.top + innerH / 2})`}>{def.yLabel}</text>
          <text x={PAD.left + innerW - 4} y={PAD.top + 11} textAnchor="end" className="fill-foreground/50" fontSize="7" fontFamily="monospace" fontWeight="600">{def.quads[0]}</text>
          <text x={PAD.left + 4} y={PAD.top + 11} textAnchor="start" className="fill-foreground/50" fontSize="7" fontFamily="monospace" fontWeight="600">{def.quads[1]}</text>
          <text x={PAD.left + 4} y={PAD.top + innerH - 4} textAnchor="start" className="fill-foreground/50" fontSize="7" fontFamily="monospace" fontWeight="600">{def.quads[2]}</text>
          <text x={PAD.left + innerW - 4} y={PAD.top + innerH - 4} textAnchor="end" className="fill-foreground/50" fontSize="7" fontFamily="monospace" fontWeight="600">{def.quads[3]}</text>
        </svg>
      </div>
      <div className="h-4 text-[9px] text-muted-foreground/60 truncate shrink-0">
        {hoveredPoint ? `${hoveredPoint.teamName}${hoveredPoint.ownerName ? ` — ${hoveredPoint.ownerName}` : ''}` : ''}
      </div>
    </div>
  )
}

export default function ScatterPlots({ teamStats, rosters, hoveredRosterId, onHover, onClick, highlightedRosterIds }: Props) {
  const weeks = teamStats.weeks.length
  const data = teamStats.rosters

  const rosterColorMap = new Map<number, string>()
  const sortedById = [...data].sort((a, b) => a.roster_id - b.roster_id)
  sortedById.forEach((r, i) => rosterColorMap.set(r.roster_id, TEAM_COLORS[i % TEAM_COLORS.length]))

  const plotDefs: PlotDef[] = [
    {
      key: 'scoring-efficiency',
      title: 'Scoring vs Efficiency',
      question: 'Do you score a lot without wasting points?',
      description: 'Plots average weekly points against lineup efficiency. High PF + high Eff = elite. High PF + low Eff = you leave points on the bench.',
      paragraph: 'X = average weekly points for. Y = lineup efficiency (actual PF % of optimal PF). Top-right means you score a lot and waste very little.',
      xLabel: 'Avg PF →',
      yLabel: 'Efficiency % →',
      quads: ['Elite', 'Maximizer', 'Dumpster Fire', 'Underachiever'],
      x: (r) => r.season_avg,
      y: (r) => r.avg_efficiency,
    },
    {
      key: 'roster-management',
      title: 'Roster Talent vs Management',
      question: 'Do you have good players and use them well?',
      description: 'Compares raw roster talent (avg optimal PF) against lineup efficiency. Strong roster + high Eff = complete team.',
      paragraph: 'X = average optimal lineup points (roster talent). Y = lineup efficiency. Top-right = your roster is stacked and you start the right guys.',
      xLabel: 'Avg Optimal PF →',
      yLabel: 'Efficiency % →',
      quads: ['Complete', 'Hard Carry', 'Double Fail', 'Talent Waster'],
      x: (r, _, w) => r.weekly.reduce((s, ww) => s + ww.optimal, 0) / w,
      y: (r) => r.avg_efficiency,
    },
    {
      key: 'luck-skill',
      title: 'Luck vs Skill',
      question: 'Are you winning because you\'re good or lucky?',
      description: 'All-play win % measures true team strength. Actual win % vs all-play reveals luck. Higher actual than all-play = fortunate schedule.',
      paragraph: 'X = all-play win % (how often you\'d beat every team each week). Y = actual win %. If your Y exceeds X, your schedule carried you.',
      xLabel: 'All-Play Win % →',
      yLabel: 'Win % →',
      quads: ['Legit', 'Unlucky', 'Deserved Loser', 'Lucky'],
      x: (r) => r.all_play_total > 0 ? (r.all_play_wins / r.all_play_total) * 100 : 0,
      y: (_r, roster) => roster ? (roster.wins / (roster.wins + roster.losses + roster.ties)) * 100 : 0,
    },
    {
      key: 'offense-defense',
      title: 'Offense vs Defense',
      question: 'Are you winning by scoring or stopping others?',
      description: 'Avg PF vs avg PA. High PF + low PA = dominant. High PF + high PA = track meet. Low PF + low PA = grinder.',
      paragraph: 'X = average PF (right = more). Y = average PA (up = worse defense). Top-right (Dominant) = you score big.',
      xLabel: 'Avg PF →',
      yLabel: 'Avg PA →',
      quads: ['Dominant', 'Grinder', 'Swiss Cheese', 'Track Meet'],
      x: (r) => r.season_avg,
      y: (r, _, w) => r.weekly.reduce((s, ww) => s + ww.pa, 0) / w,
    },
    {
      key: 'consistency-ceiling',
      title: 'Consistency vs Ceiling',
      question: 'How reliable is your weekly scoring?',
      description: 'Avg PF vs PF standard deviation. Higher avg with lower std = reliably strong. Higher std = unpredictable week-to-week.',
      paragraph: 'X = average PF (right = more). Y = PF standard deviation (up = more volatile). Clockwise from top-right: Steady (high PF, consistent), Boom-or-bust (low PF, unpredictable), Bust (low PF, consistent), Lottery Ticket (high PF, unpredictable).',
      xLabel: 'Avg PF →',
      yLabel: 'PF Std Dev →',
      quads: ['Steady', 'Boom-or-bust', 'Bust', 'Lottery Ticket'],
      x: (r) => r.season_avg,
      y: (r) => Math.min(r.season_std, 60),
    },
    {
      key: 'manager-skill',
      title: 'Manager Skill',
      question: 'Are your lineups costing you wins?',
      description: 'Wins left on the bench (optimal wins minus actual wins) vs average points scored. Positive = your lineup mistakes cost you wins. Negative = you won despite suboptimal lineups (luck). Top-left = you earn your wins.',
      paragraph: 'X = wins left on the bench (optimal lineup wins minus actual wins). Y = average weekly points for. Positive X means you left wins on the bench. True contenders sit top-left.',
      xLabel: 'Wins Left on Bench →',
      yLabel: 'Avg PF →',
      quads: ['Squanderer', 'Real Deal', 'Maximizer', 'Hopeless'],
      x: (r, roster) => r.optimal_wins - (roster?.wins ?? 0),
      y: (r) => r.season_avg,
    },
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {plotDefs.map((def) => (
        <ScatterPlot
          key={def.key}
          def={def}
          data={data}
          rosters={rosters}
          weeks={weeks}
          rosterColorMap={rosterColorMap}
          hoveredRosterId={hoveredRosterId}
          onHover={onHover}
          onClick={onClick}
          highlightedRosterIds={highlightedRosterIds}
        />
      ))}
    </div>
  )
}
