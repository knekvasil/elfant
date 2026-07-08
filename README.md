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
├── scripts/
│   ├── db-tunnel.sh           # k3s database tunnel for local dev
│   └── dev-refresh.sh         # Refresh dev DB from prod
├── Dockerfile                 # Container build
├── docker-compose.yml         # Container deployment
├── .env.example               # Environment variable reference
└── pyproject.toml             # Python dependencies
```

## Development

The database runs on the k3s cluster (namespace `database`). Local development uses a dedicated `dev_elfant` database — completely isolated from production. Connect via `kubectl port-forward`.

### Prerequisites

- Python 3.14+
- Node.js 26+
- uv (Python package manager)
- kubectl with access to the k3s cluster
- `scripts/db-tunnel.sh` (port-forward) or PostgreSQL client (optional)

### 1. Database tunnel

Run this in a dedicated terminal (leave it running):

```bash
./scripts/db-tunnel.sh
```

| Variable | Default | Description |
|---|---|---|
| `ELFANT_K8S_NAMESPACE` | `database` | Kubernetes namespace |
| `ELFANT_DB_SERVICE` | `postgres` | Kubernetes service name |
| `ELFANT_DB_LOCAL_PORT` | `5432` | Port on localhost |
| `ELFANT_DB_REMOTE_PORT` | `5432` | Port on the service |

### 2. Backend

With the tunnel running in another terminal:

```bash
# Install
uv pip install . nflreadpy

# Set up the database URL (create a .env file or export directly)
export ELFANT_DATABASE_URL="postgresql://user:pass@localhost:5432/dev_elfant"
elfant init                 # Create tables
elfant sync-players         # Sync player data from Sleeper

# Run (hot-reload enabled)
uvicorn elfant.web:app --reload --host 0.0.0.0 --port 8008  # http://localhost:8008
```

> **Note:** The dev database is empty initially. Data is populated on-demand when you look up a league. If you need a fuller dataset, run `./scripts/dev-refresh.sh` to copy prod data into `dev_elfant`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

### Refresh dev data from production (optional)

```bash
./scripts/dev-refresh.sh
```

This replaces all data in `dev_elfant` with a fresh copy from `elfant` (production). Useful when you want realistic data for UI work.

### Docker (optional)

If you prefer running the app in Docker while using the host tunnel:

```bash
export ELFANT_DATABASE_URL="postgresql://user:pass@host.docker.internal:5432/dev_elfant"
docker compose up -d
```

## Schema Migrations

Schema changes are managed with Alembic. Migration files live in `alembic/versions/`.

### Workflow for making schema changes

1. Edit the models in `elfant/db/models.py`
2. Generate a migration:
   ```bash
   alembic revision --autogenerate -m "description of change"
   ```
3. Review the generated file in `alembic/versions/`
4. Apply to your dev database:
   ```bash
   elfant init
   ```
   Or directly:
   ```bash
   alembic upgrade head
   ```
5. Commit both the model changes and the migration file
6. Push to master — CI/CD applies migrations to production automatically

## Data Sources

| Source | Data | Sync Function |
|---|---|---|
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

The production database is managed on the k3s cluster directly (not via tunnel).

See `elfant.kajnekvasil.com` for the live instance.
