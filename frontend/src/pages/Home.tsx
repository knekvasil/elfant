import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Search, ArrowRight, Trash2 } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { fetchLeagueChain } from '../lib/api'
import type { LeagueChain } from '../types'

const STORAGE_KEY = 'elfant_leagues'

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

  const statusBadge = (status: string) => {
    const color =
      status === 'complete'
        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
        : status === 'in_season'
          ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
          : 'border-blue-500/30 bg-blue-500/10 text-blue-400'
    const label = status === 'in_season' ? 'Live' : status === 'complete' ? 'Done' : status
    return <Badge variant="outline" className={color}>{label}</Badge>
  }

  const isEmpty = chains.length === 0 && !loading

  return (
    <div className={isEmpty ? 'min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-4' : 'max-w-4xl mx-auto p-4 space-y-6'}>
      {isEmpty ? (
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 size-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Search className="size-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">elfant</CardTitle>
            <CardDescription>
              Enter a Sleeper league ID to view standings, rosters, matchups, and draft history.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                placeholder="e.g. 1250519825399169024"
                value={leagueId}
                onChange={(e) => setLeagueId(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" size="icon">
                <ArrowRight className="size-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">elfant</CardTitle>
              <CardDescription>
                Enter a Sleeper league ID to view standings, rosters, matchups, and draft history.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="flex gap-2">
                <Input
                  placeholder="e.g. 1250519825399169024"
                  value={leagueId}
                  onChange={(e) => setLeagueId(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" size="icon">
                  <ArrowRight className="size-4" />
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Your Leagues</h2>
            {loading && <p className="text-muted-foreground text-sm">Loading leagues...</p>}
            {chains.map(chain => {
              const maxTeams = chain.seasons.reduce((m, s) => Math.max(m, s.total_rosters), 0)
              return (
                <Card key={chain.league_id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <CardTitle className="text-lg truncate">{chain.name}</CardTitle>
                        <CardDescription>
                          {chain.seasons.length} {chain.seasons.length === 1 ? 'season' : 'seasons'}
                          {maxTeams > 0 && ` · ${maxTeams} teams`}
                        </CardDescription>
                      </div>
                      <Link
                        to={`/league/${chain.group_id}`}
                        className="text-sm font-medium h-8 px-3 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors inline-flex items-center"
                      >
                        Overview
                      </Link>
                      <Button variant="ghost" size="icon" onClick={() => handleRemove(chain.league_id)} className="shrink-0">
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {chain.seasons.map(s => (
                        <Link
                          key={s.league_id}
                          to={`/league/${chain.group_id}/${s.league_id}`}
                          className="inline-flex items-center gap-1.5 text-sm font-medium h-8 px-3 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
                        >
                          {s.season}
                          {statusBadge(s.status)}
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
