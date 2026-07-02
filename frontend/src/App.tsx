import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { Trophy, House, Sun, Moon } from 'lucide-react'
import { cn } from './lib/utils'
import Home from './pages/Home'
import League from './pages/League'
import PlayerDetail from './pages/PlayerDetail'

export default function App() {
  const [dark, setDark] = useState(true)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  return (
    <BrowserRouter>
      <div className={cn(dark ? 'dark' : '', 'min-h-screen bg-background text-foreground')}>
        <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 font-bold text-lg text-primary hover:opacity-80 transition-opacity">
              <Trophy className="size-5" />
              elfant
            </Link>
            <nav className="flex items-center gap-3">
              <button
                onClick={() => setDark(!dark)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Toggle theme"
              >
                {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </button>
              <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
                <House className="size-4" />
              </Link>
            </nav>
          </div>
        </header>
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/league/:leagueId" element={<League />} />
            <Route path="/league/:leagueId/player/:playerId" element={<PlayerDetail />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
