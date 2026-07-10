import { useEffect, useMemo, useState } from 'react'
import { Medal, Crown, Star, Trash2 } from 'lucide-react'
import { Card, CardContent } from '../components/ui/card'
import { Skeleton } from '../components/ui/skeleton'
import { fetchPlayoffs } from '../lib/api'
import type { BracketMatch, PlayoffData } from '../types'

interface Props {
  leagueId: string
}

const RH = 52
const RG = 10
const CW = 170
const CG = 40

function layout(ms: BracketMatch[]) {
  const byId = new Map<number, { row: number; col: number }>()
  const sorted = [...ms].sort((a, b) => a.round - b.round || a.match_id - b.match_id)
  const maxR = Math.max(...sorted.map((m) => m.round), 0)
  const pos = new Map<number, number>()

  sorted.filter((m) => m.round === 1).forEach((m, i) => pos.set(m.match_id, i * 2))

  const fid = (f: { w?: number; l?: number } | null): number | null =>
    f ? (f.w ?? f.l ?? null) : null

  for (let r = 2; r <= maxR; r++) {
    for (const m of sorted.filter((m) => m.round === r)) {
      const fds = [fid(m.team_1_from), fid(m.team_2_from)].filter((x): x is number => x != null)
      if (fds.length) pos.set(m.match_id, fds.reduce((s, id) => s + (pos.get(id) ?? 0), 0) / fds.length)
    }
  }

  for (let r = 1; r <= maxR; r++) {
    let prev = -Infinity
    for (const m of sorted.filter((m) => m.round === r).sort((a, b) => (pos.get(a.match_id) ?? 0) - (pos.get(b.match_id) ?? 0))) {
      const y = pos.get(m.match_id) ?? 0
      if (y <= prev + 0.99) pos.set(m.match_id, prev + 1)
      prev = pos.get(m.match_id) ?? 0
    }
  }

  sorted.forEach((m) => byId.set(m.match_id, { row: pos.get(m.match_id) ?? 0, col: m.round - 1 }))
  const rows = [...pos.values()]
  return { byId, maxRow: Math.max(...rows, 0), maxCol: Math.max(...sorted.map((m) => m.round - 1), 0) }
}

export default function PlayoffBracketView({ leagueId }: Props) {
  const [data, setData] = useState<PlayoffData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchPlayoffs(leagueId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [leagueId])

  const w = data?.winners ?? []
  const los = data?.losers ?? []

  const winPath = useMemo(() => w.filter((m) => [1, 2, 3, 4, 5, 6, 9].includes(m.match_id)), [w])
  const lyW = useMemo(() => layout(winPath), [winPath])

  const losPath = useMemo(() => {
    if (los.length <= 2) return los
    const maxR = Math.max(...los.map((m) => m.round))
    const lastRound = los.filter((m) => m.round === maxR)
    if (lastRound.length <= 1) return los
    const keep = lastRound.filter((m) => m.position !== 3)
    if (keep.length >= 1) return [...los.filter((m) => m.round < maxR), ...keep]
    return los
  }, [los])
  const lyL = useMemo(() => layout(losPath), [losPath])

  if (loading) return <Skeleton className="h-48 w-full" />
  if (w.length === 0 && los.length === 0) return <Card><CardContent className="pt-6 text-muted-foreground text-sm text-center">No playoff data.</CardContent></Card>

  const m1 = w.find((m) => m.position === 1)
  const m3 = w.find((m) => m.position === 3)

  const getEntry = (m: typeof m1, key: 'winner' | 'loser') => {
    if (!m) return null
    if (key === 'winner') return { name: m.winner_name, owner: m.winner_name === m.team_1_name ? m.team_1_owner : m.team_2_owner, avatar: m.winner_name === m.team_1_name ? m.team_1_avatar : m.team_2_avatar }
    return { name: m.loser_name, owner: m.loser_name === m.team_1_name ? m.team_1_owner : m.team_2_owner, avatar: m.loser_name === m.team_1_name ? m.team_1_avatar : m.team_2_avatar }
  }
  const champEntry = m1 ? getEntry(m1, 'winner') : null
  const runnerEntry = m1 ? getEntry(m1, 'loser') : null
  const thirdEntry = m3 ? getEntry(m3, 'winner') : null

  const consFinal = losPath.length > 0 ? losPath[losPath.length - 1] : null
  const trashKing = consFinal ? (() => {
    const s1 = consFinal.team_1_score ?? 0
    const s2 = consFinal.team_2_score ?? 0
    const isT1 = s1 < s2
    return { name: isT1 ? consFinal.team_1_name : consFinal.team_2_name, owner: isT1 ? consFinal.team_1_owner : consFinal.team_2_owner, avatar: isT1 ? consFinal.team_1_avatar : consFinal.team_2_avatar }
  })() : null

  const mx = (c: number) => c * (CW + CG) + 20
  const my = (r: number) => r * (RH + RG)

  const TRow = ({ n, a, s, w: isW, poop }: { n: string | null; a: string | null; s: number | null; w: boolean; poop?: boolean }) => (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${isW ? 'bg-primary/5' : ''}`}>
      <div className="size-4 rounded-full bg-muted overflow-hidden ring-1 ring-border flex-shrink-0">
        {a ? <img src={a} alt="" className="size-full object-cover" /> : <span className="size-full flex items-center justify-center text-[7px] font-bold text-muted-foreground">{(n || '?').charAt(0).toUpperCase()}</span>}
      </div>
      <span className={`text-[11px] truncate flex-1 ${isW ? 'font-semibold text-foreground' : 'text-muted-foreground/70'}`}>{n || '—'}</span>
      {s != null && <span className={`text-[10px] font-mono tabular-nums flex-shrink-0 ${isW ? 'text-foreground' : 'text-muted-foreground/50'}`}>{s.toFixed(1)}</span>}
      {isW && <span className="flex-shrink-0">{poop ? <Trash2 className="size-2.5 text-zinc-400" /> : <Star className="size-2.5 text-yellow-400 fill-yellow-400" />}</span>}
    </div>
  )

  const renderBracket = (ms: BracketMatch[], ly: ReturnType<typeof layout>, poop?: boolean) => {
    if (ms.length === 0) return null
    const h = ly.maxRow * (RH + RG) + RH + 8
    return (
      <div className="relative" style={{ height: h }}>
        {ms.map((m) => {
          const lm = ly.byId.get(m.match_id)
          if (!lm) return null
          return (
            <div key={m.match_id} className="absolute rounded-md border border-border bg-card/90 shadow-sm overflow-hidden" style={{ left: mx(lm.col), top: my(lm.row), width: CW }}>
              <TRow n={m.team_1_name} a={m.team_1_avatar} s={m.team_1_score} w={m.winner === m.team_1} poop={poop} />
              <div className="h-px bg-border/30" />
              <TRow n={m.team_2_name} a={m.team_2_avatar} s={m.team_2_score} w={m.winner === m.team_2} poop={poop} />
            </div>
          )
        })}
      </div>
    )
  }

  const PodiumEntry = ({ entry, icon, label, ringColor, size }: { entry: typeof champEntry; icon: React.ReactNode; label: string; ringColor: string; size?: string }) => {
    if (!entry) return null
    const isChampOrKing = label === 'Champion' || label === 'Trash King'
    return (
      <div className="flex flex-col items-center gap-1.5">
        <div className={`flex items-center justify-center ${isChampOrKing ? 'size-7' : 'size-6'} rounded-full bg-muted/50`}>
          {icon}
        </div>
        <div className={`${size || 'size-10'} rounded-full bg-muted ${ringColor} overflow-hidden`}>
          {entry.avatar ? <img src={entry.avatar} alt="" className="size-full object-cover" /> : <div className="size-full flex items-center justify-center text-sm font-bold text-muted-foreground">{(entry.name || '?').charAt(0).toUpperCase()}</div>}
        </div>
        <span className="text-xs font-semibold truncate max-w-[120px] text-center">{entry.name}</span>
        <span className="text-[9px] text-muted-foreground truncate max-w-[120px] text-center">{entry.owner}</span>
        <span className="text-[8px] text-muted-foreground/50">{label}</span>
        <div className={`rounded-t-sm ${isChampOrKing ? 'w-16 h-3' : 'w-14 h-2'} ${label === 'Champion' ? 'bg-yellow-400/40' : label === 'Trash King' ? 'bg-zinc-600/30' : 'bg-gray-300/30'}`} />
      </div>
    )
  }

  const hW = lyW.maxRow * (RH + RG) + RH + 8
  const hL = lyL.maxRow * (RH + RG) + RH + 8
  const wW = (lyW.maxCol + 1) * (CW + CG) + 40
  const wL = (lyL.maxCol + 1) * (CW + CG) + 40

  return (
    <div className="space-y-3">
      {/* Podium grid: left column = top 3, right column = trash king */}
      {(m1 || trashKing) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-muted/10 rounded-lg border border-border/50 flex items-center justify-center gap-6 py-3 px-2">
            {runnerEntry && <PodiumEntry entry={runnerEntry} icon={<Medal className="size-4 text-gray-300" />} label="Runner-Up" ringColor="ring-2 ring-gray-300/30" />}
            {champEntry && <PodiumEntry entry={champEntry} icon={<Crown className="size-5 text-yellow-400" />} label="Champion" ringColor="ring-2 ring-yellow-400/40" size="size-12" />}
            {thirdEntry && <PodiumEntry entry={thirdEntry} icon={<Medal className="size-4 text-amber-600" />} label="3rd Place" ringColor="ring-2 ring-amber-600/30" />}
          </div>
          <div className="bg-zinc-500/5 rounded-lg border border-zinc-600/20 flex items-center justify-center py-3 px-2">
            {trashKing && <PodiumEntry entry={trashKing} icon={<Trash2 className="size-5 text-zinc-500" />} label="Trash King" ringColor="ring-2 ring-zinc-600/30" size="size-12" />}
          </div>
        </div>
      )}

      {/* Two-column bracket */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {winPath.length > 0 && (
          <Card className="bg-card/50 overflow-hidden h-full">
            <CardContent className="p-0 overflow-x-auto flex items-start justify-start min-h-[200px] h-full [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              <div className="p-2" style={{ height: Math.max(hW, 120), width: wW + 20, minWidth: wW + 20 }}>
                {renderBracket(winPath, lyW)}
              </div>
            </CardContent>
          </Card>
        )}
        {losPath.length > 0 && (
          <Card className="bg-card/50 overflow-hidden h-full">
            <CardContent className="p-0 overflow-x-auto flex items-start justify-start min-h-[200px] h-full [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              <div className="p-2" style={{ height: Math.max(hL, 120), width: wL + 20, minWidth: wL + 20 }}>
                {renderBracket(losPath, lyL, true)}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
