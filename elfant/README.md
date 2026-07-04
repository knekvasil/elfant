# elfant — Backend

Python 3.12 + FastAPI backend serving the elfant fantasy football app.

## Modules

### `api/`
- **sleeper.py** — HTTP client for the [Sleeper API](https://docs.sleeper.app/). Rate-limited (1000 req/min). Provides methods for leagues, rosters, users, matchups, drafts, transactions, playoff brackets, traded picks, and NFL state.

### `db/`
- **base.py** — SQLAlchemy engine, session factory, declarative base. Uses `ELFANT_DATABASE_URL` env var (default: `postgresql://elfant:elfant@localhost:5432/elfant`).
- **models.py** — ORM models:
  - `User` — Sleeper users
  - `League` — Leagues (with settings, scoring_settings, roster_positions as JSONB)
  - `Roster` — Rosters (players, starters, reserve as JSONB)
  - `Player` — NFL players (bio, IDs, injury status)
  - `PlayerWeeklyStat` — Per-player, per-week stats (offensive, defensive, kicking, advanced, snap counts)
  - `Draft` / `DraftPick` — Drafts and draft picks
  - `Matchup` — Weekly matchups
  - `Transaction` — Waivers/trades
  - `PlayoffBracket` — Playoff bracket entries
  - `TradedPick` — Traded draft picks

### `sync/`
- **sync.py** — All data sync functions. Sources:
  - Sleeper API: users, leagues, rosters, drafts, matchups, transactions, playoff brackets
  - nflreadpy: player stats, team stats, schedules, PBP, snap counts, injuries, Next Gen Stats, player ID mappings
  - Includes chain-sync for linked previous seasons

### `web.py`
FastAPI application with routes:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/league/{league_id}` | League data + rosters + drafts + chain navigation |
| GET | `/api/league/{league_id}/chain` | League season chain |
| GET | `/api/league/{league_id}/overview` | Cross-season overview (champions, medals, power rankings, rivalries) |
| POST | `/api/league/{league_id}/refresh` | Full league data resync |
| GET | `/api/league/{league_id}/matchups/{week}` | Weekly matchups |
| GET | `/api/league/{league_id}/playoffs` | Playoff bracket |
| GET | `/api/league/{league_id}/rankings` | Weekly power rankings |
| GET | `/api/league/{league_id}/team-stats` | Team efficiency stats |
| GET | `/api/league/{league_id}/transactions` | Transaction history |
| GET | `/api/league/{league_id}/player-stats` | Player stats with league scoring |
| GET | `/api/league/{league_id}/player/{player_id}/career` | Multi-year player career |
| GET | `/api/player/{player_id}/schedule` | Schedule + opponent difficulty |
| GET | `/api/{full_path:path}` | SPA fallback (serves index.html) |

### `scoring.py`
Fantasy points computation engine. Maps raw stat keys to scoring rule keys with defaults. Handles:
- All offensive, defensive, and kicking stats
- Points-allowed and yards-allowed bucket bonuses/penalties
- D/ST-specific rules (ST TD disambiguation, kicker stat deductions)
- Configurable per-league via `scoring_settings` dict

### `cli.py`
Command-line interface:
- `elfant init` — Create database tables
- `elfant sync-players` — Sync player data from Sleeper
- `elfant sync-league <id>` — Sync a specific league
- `elfant sync-stats [--seasons YYYY,YYYY]` — Sync all weekly stats, snap counts, TOP
- `elfant info` — DB record counts
- `elfant serve` — Start the web server

## Auto-refresh

Every league lookup auto-syncs all data:
1. League metadata, users, rosters
2. Drafts + draft picks
3. Matchups (only newly completed weeks)
4. Playoff brackets
5. Previous seasons in the chain
6. Opponent strength metrics (for schedule difficulty)
