import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ArrowRight } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'

export default function Home() {
  const [leagueId, setLeagueId] = useState('')
  const navigate = useNavigate()

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (leagueId.trim()) navigate(`/league/${leagueId.trim()}`)
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-4">
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
    </div>
  )
}
