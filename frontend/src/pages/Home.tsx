import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowRight, Trash2, ShieldHalf } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card } from '../components/ui/card'
import { fetchLeagueChain } from '../lib/api'
import type { LeagueChain } from '../types'

const STORAGE_KEY = 'elfant_leagues'
const EXAMPLE_ID = '1250519825399169024'

function getStoredLeagues(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function addStoredLeague(id: string) {
  const leagues = getStoredLeagues()
  if (!leagues.includes(id)) {
    leagues.unshift(id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(leagues))
  }
}

function removeStoredLeague(id: string) {
  const leagues = getStoredLeagues().filter(l => l !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(leagues))
}

export default function Home() {
  const [leagueId, setLeagueId] = useState('')
  const [chains, setChains] = useState<LeagueChain[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const stored = getStoredLeagues()
    if (stored.length === 0) {
      setLoading(false)
      return
    }
    Promise.all(stored.map(id => fetchLeagueChain(id).catch(() => null)))
      .then(results => setChains(results.filter((r): r is LeagueChain => r !== null)))
      .finally(() => setLoading(false))
  }, [])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (leagueId.trim()) {
      addStoredLeague(leagueId.trim())
      setLeagueId('')
      navigate(`/league/${leagueId.trim()}`)
    }
  }

  const handleRemove = (id: string) => {
    removeStoredLeague(id)
    setChains(prev => prev.filter(c => c.league_id !== id))
  }

  const handleExample = () => {
    addStoredLeague(EXAMPLE_ID)
    navigate(`/league/${EXAMPLE_ID}`)
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg mx-auto text-center space-y-8">
        <div>
          <ShieldHalf className="size-10 mx-auto text-primary mb-4" />
          <h1 className="text-3xl font-bold tracking-tight">elfant</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Sleeper fantasy league history, stats, and analysis.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            placeholder="Paste your Sleeper league ID…"
            value={leagueId}
            onChange={(e) => setLeagueId(e.target.value)}
            className="flex-1 h-11 text-sm"
          />
          <Button type="submit" size="default" className="h-11 px-5 gap-1.5" disabled={!leagueId.trim()}>
            View
            <ArrowRight className="size-4" />
          </Button>
        </form>

        <div>
          <button
            type="button"
            onClick={handleExample}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4 decoration-muted-foreground/30 hover:decoration-foreground/50"
          >
            Try an example league &rarr;
          </button>
        </div>

        {chains.length > 0 && (
          <div className="pt-4 border-t border-border/40 w-full text-left">
            <h2 className="text-sm font-semibold text-muted-foreground mb-3">Saved Leagues</h2>
            <div className="space-y-2">
              {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
              {chains.map(chain => {
                const maxTeams = chain.seasons.reduce((m, s) => Math.max(m, s.total_rosters), 0)
                const years = chain.seasons.map(s => s.season).sort()
                const yearRange = years.length > 1 ? `${years[0]}–${years[years.length - 1]}` : years[0]
                return (
                  <Card key={chain.league_id} className="relative">
                    <div className="flex items-center justify-between px-4 py-3">
                      <Link to={`/league/${chain.group_id}`} className="min-w-0 flex-1 after:absolute after:inset-0">
                        <p className="text-sm font-medium truncate">{chain.name}</p>
                        <p className="text-xs text-muted-foreground mt-px">
                          {chain.seasons.length} {chain.seasons.length === 1 ? 'season' : 'seasons'}
                          {` · ${yearRange}`}
                          {maxTeams > 0 && ` · ${maxTeams} teams`}
                        </p>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.preventDefault(); handleRemove(chain.league_id) }}
                        className="size-7 shrink-0 relative z-10 text-muted-foreground/50 hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
