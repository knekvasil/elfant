# elfant — Frontend

React 19 + TypeScript SPA for viewing Sleeper fantasy football league history, stats, and analysis.

## Tech

- **React 19** + TypeScript
- **Vite** — Build tool
- **Tailwind CSS** — Styling
- **Recharts** — Charts (line charts, radar charts)
- **shadcn/ui** — Component primitives (cards, badges, tooltips, tabs, breadcrumbs, skeletons)
- **Lucide** — Icons
- **React Router v7** — Client-side routing

## Routes

| Path | Component | Description |
|------|-----------|-------------|
| `/` | `Home` | Landing page + saved leagues |
| `/league/:groupId` | `LeagueOverview` | Cross-season history, hall of fame, power rankings |
| `/league/:groupId/:seasonLeagueId` | `League` | Single-season view (standings, matchups, draft, playoffs) |
| `/league/:groupId/:seasonLeagueId/player/:playerId` | `PlayerDetail` | Player career stats, heatmap, schedule |

## Key Components

### Pages
- **Home.tsx** — League search, saved leagues with year range
- **LeagueOverview.tsx** — Season history, HOF, trash king HOF, power rankings, individual events
- **League.tsx** — Tabbed season view (power rankings, standings, draft, matchups, playoffs, players, activity)
- **PlayerDetail.tsx** — Player card, usage stats, trend, volatility, weekly heatmap, consistency chart, injury history, schedule, defense rankings

### Components
- **PlayerHeatGrid** — Weekly fantasy points heatmap with stat-breakdown tooltips
- **PlayerLineChart** — Multi-season weekly points line chart
- **DefRankings** — NFL defense rankings histogram (#1–32 green–red)
- **LeagueTimeline** — Owner participation matrix colored by placement
- **PowerRankings** — Composite score rankings with radar charts
- **VolatilityChart** — Weekly points distribution histogram
- **UsagePie** — Circular progress indicator for snap%, TOP%, usage shares

### UI Components (`components/ui/`)
- Badge, Breadcrumb, Button, Card, Input, Skeleton, Tabs, Tooltip

## Data Flow

1. User enters a Sleeper league ID
2. `LeagueOverview` fetches `/api/league/{id}/overview` — full chain of seasons
3. `League` fetches `/api/league/{id}` — individual season data (rosters, matchups, drafts)
4. `PlayerDetail` fetches:
   - `/api/league/{id}/player/{playerId}/career` — multi-year stats
   - `/api/player/{playerId}/schedule?league_id=...` — schedule + opponent difficulty

## Build

```bash
npm install
npm run build        # Outputs to dist/
npm run dev          # Dev server at localhost:5173
```
