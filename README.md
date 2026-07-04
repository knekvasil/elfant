# elfant

Sleeper fantasy football league history, stats, and analysis.

## Overview

elfant connects to the [Sleeper API](https://docs.sleeper.app/) and [nflreadpy](https://github.com/nflverse/nflreadpy) to provide a comprehensive view of fantasy football leagues across multiple seasons. It automatically syncs league data, player stats, team defense stats, snap counts, play-by-play data, and more.

## Features

- **League Overview** — Cross-season history with champion, runner-up, and trash king tracking
- **Player Timelines** — Owner participation matrix with placement coloring
- **Player Career** — Multi-season stat history, weekly heatmaps, consistency charts, volatility analysis
- **IDP Support** — Individual defensive player stats and snap counts
- **Team Defense** — Full D/ST scoring breakdown, NFL defense rankings histogram
- **Schedule** — Full regular season schedule with opponent difficulty ratings (color-coded #1–32)
- **Power Rankings** — Composite scoring across win%, avg PF, playoff rate, and championship score
- **Player Search** — Filterable by position (including IDP), ownership status
- **Auto-refresh** — Data synced on every league lookup; no manual refresh needed

## Tech Stack

### Backend
- **Python 3.14** — FastAPI web framework (uv package manager)
- **PostgreSQL** — Database with SQLAlchemy ORM
- **nflreadpy** — NFL data (player stats, team stats, PBP, snap counts, schedules, injuries)
- **Sleeper API** — League data, rosters, matchups, drafts, transactions

### Frontend
- **React 19** + TypeScript
- **Vite** — Build tool
- **Tailwind CSS** — Styling
- **Recharts** — Charts
- **shadcn/ui** — Component primitives

## Project Structure

```
elfant/
├── elfant/                    # Python backend
│   ├── api/
│   │   └── sleeper.py         # Sleeper API client
│   ├── db/
│   │   ├── base.py            # SQLAlchemy engine + session
│   │   └── models.py          # Database models
│   ├── sync/
│   │   └── sync.py            # Data sync functions (nflreadpy + Sleeper)
│   ├── cli.py                 # CLI commands
│   ├── config.py              # Configuration
│   ├── scoring.py             # Fantasy points scoring engine
│   ├── web.py                 # FastAPI routes / REST API
│   └── templates/             # Jinja2 templates (if any)
├── frontend/                  # React SPA
│   ├── src/
│   │   ├── components/        # UI components
│   │   ├── pages/             # Route pages
│   │   ├── lib/               # API client, utilities
│   │   └── types.ts           # TypeScript interfaces
│   └── dist/                  # Built static files
├── Dockerfile                 # Container build
├── docker-compose.yml         # Container deployment
└── pyproject.toml             # Python dependencies
```

## Quick Start

### Prerequisites
- Python 3.14+
- Node.js 26+
- PostgreSQL
- uv (Python package manager)

### Setup

```bash
# Backend
uv pip install . nflreadpy

# Frontend
cd frontend && npm install

# Database
export ELFANT_DATABASE_URL="postgresql://user:pass@localhost:5432/elfant"
elfant init                 # Create tables
elfant sync-players         # Sync player data from Sleeper
elfant sync-stats --seasons 2025  # Sync weekly stats

# Run
elfant serve                # Start on http://localhost:8008
```

### Docker

```bash
docker compose up -d
```

## Data Sources

| Source | Data | Sync Function |
|--------|------|--------------|
| Sleeper API | Leagues, rosters, users, matchups, drafts, transactions, playoff brackets | On-demand via league lookup |
| nflreadpy (`load_player_stats`) | Weekly player stats (passing, rushing, receiving, defense, kicking) | `sync_player_weekly_stats` |
| nflreadpy (`load_team_stats`) | Weekly team defense stats | `sync_team_weekly_stats` |
| nflreadpy (`load_schedules`) | Game schedules, scores, Vegas lines | `sync_team_defense_opp_stats` |
| nflreadpy (`load_pbp`) | Play-by-play (4th down stops, 3-and-outs, time of possession) | `sync_defense_pbp_stats`, `sync_defense_time_of_possession` |
| nflreadpy (`load_snap_counts`) | Player snap counts and percentages | `sync_player_snap_counts` |
| nflreadpy (`load_injuries`) | Weekly injury reports | `sync_injuries` |
| nflreadpy (`load_nextgen_stats`) | Next Gen Stats (air yards, CPOE) | `sync_nextgen_stats` |
| nflreadpy (`load_ff_playerids`) | Player ID mappings (Sleeper ↔ GSIS ↔ PFR) | `sync_player_ids` |

## Deployment

The project deploys as a single Docker container serving both the FastAPI backend and the built React frontend behind a Cloudflare tunnel.

```bash
docker build -t knekvasil/elfant:latest .
docker compose up -d
```

See `elfant.kajnekvasil.com` for the live instance.
