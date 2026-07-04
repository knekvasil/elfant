## Title: Custom Raw-Stat Projection Model

### Problem

Currently we have no player projections. FantasyPros weekly rankings (`r2p_pts`) are in half-PPR standard scoring, so they don't reflect league-specific rules (IDP scoring, custom D/ST scoring, non-standard point values, etc.). Raw stat projections from nflreadpy don't exist.

### Goal

Build a custom projection system that:
1. Projects raw weekly stats (passing/rushing/receiving/defensive) for each player
2. Feeds projected raw stats through `fantasy_points()` with the league's scoring rules
3. Returns league-specific projected fantasy points per player per week

### Algorithm Design

**Core formula** (per stat category):
```
projected_stat = player_baseline * opponent_adjustment * team_environment
```

**Player baseline** — weighted rolling average of recent games:
- Window: last 3-5 regular season weeks
- Weighting: exponential decay (most recent week = highest weight)
- Stat categories to project: `completions`, `attempts`, `passing_yards`, `passing_tds`, `passing_int`, `carries`, `rushing_yards`, `rushing_tds`, `receptions`, `targets`, `receiving_yards`, `receiving_tds`, `def_sacks`, `def_interceptions`, `def_tackles_solo`, `def_fumbles_forced`, `def_tds`, `def_safeties`, `pts_allowed`, `yds_allowed`, `fg_made`, `pat_made`

**Opponent adjustment** — use existing `off_strength` / `def_strength` metrics from the schedule endpoint to scale a player's baseline up or down:
- For offensive players: multiply by `opponent_def_strength / league_avg_def_strength`
- For defensive players: multiply by `opponent_off_strength / league_avg_off_strength`

**Team environment** — Vegas lines from `load_schedules()`:
- `total_line` (over/under): higher total → more scoring opportunities
- `spread_line`: larger spread → possible game script effects
- Use as a multiplier: `total_line / league_avg_total`

**Special cases:**
- Rookies with little NFL data: use preseason draft position + college stats
- Players returning from injury: use season average (not recent 3-week)
- Bye weeks: projected = 0
- Post-injury/return from IR: gradual ramp-up (recent 1-2 games only)

### Implementation Plan

**Phase 1: Backend projection engine** (`elfant/projections.py`)
- New module `elfant/projections.py`
- Functions:
  - `compute_player_baseline(player_id, season, stats_reader, weights)` — weighted rolling average
  - `compute_opponent_adjustment(opponent_team, position_type, season)` — using existing strength metrics
  - `compute_team_environment(team, week, season)` — from Vegas lines in `load_schedules()`
  - `compute_projection(player_id, team, opponent, week, season, rules, position)` — orchestrates the above, returns dict of projected raw stats
  - `projected_fantasy_points(projected_stats, rules)` — wraps `fantasy_points()` from scoring.py

**Phase 2: Sync function** (`elfant/sync/sync.py`)
- New function `sync_projections(league_id, week=None)`
- For the given league's season and upcoming week:
  1. Query all rosters in the league
  2. For each player on each roster, compute projection
  3. Compute fantasy points from projected stats using league scoring rules
  4. Store results

**Phase 3: Model** (`elfant/db/models.py`)
- New model `PlayerProjection`
- Unique constraint: `(player_id, season, week, league_id)`

**Phase 4: API endpoint**
- `GET /api/league/{league_id}/projections/{week}` — returns projected points for all players in the league
- `GET /api/league/{league_id}/player/{player_id}/projections/{week}` — returns projection for a single player
- Integrate projection data into the existing schedule endpoint (add `projected_points`)

**Phase 5: Frontend display**
- Schedule card in PlayerDetail: show projected points for upcoming weeks alongside opponent difficulty
- Matchup view (League page): show projected vs actual points for each starter
- Player search: add a "Projected" column
- Player card avatar area: show projected average for upcoming week

### Data Sources Required (all already available)
| Source | What it provides | Already in project? |
|--------|-----------------|-------------------|
| `PlayerWeeklyStat` | Historical actual stats (baseline) | Yes |
| `off_strength` / `def_strength` metrics | Opponent difficulty adjustment | Yes (schedule endpoint) |
| `nfl.load_schedules()` | Vegas lines (spread, total) | Yes (schedule endpoint) |
| `nfl.load_injuries()` | Injury status for adjustments | Yes (sync_injuries) |
| `fantasy_points()` + `scoring_settings` | League-specific scoring | Yes |

### Future Improvements
- Incorporate nflreadpy weather data (wind/rain affect passing games)
- Add rolling BYE-week adjustments (players returning from BYE have a slight boost)
- Machine learning model (XGBoost/LightGBM) trained on `PlayerWeeklyStat` features + opponent + Vegas lines
- Track projection accuracy (mean absolute error) per player and per week

### Acceptance Criteria
- [ ] Projections computed for all players in a league for the upcoming week
- [ ] Projections use the league's specific scoring rules (not standard baseline)
- [ ] API returns projected fantasy points per player per week
- [ ] Frontend shows projections in schedule card (upcoming weeks)
- [ ] Frontend shows projected vs actual in matchup view
- [ ] Projection accuracy tracked and logged
- [ ] Sync runs on-demand via CLI: `elfant sync-projections --league <id>`
