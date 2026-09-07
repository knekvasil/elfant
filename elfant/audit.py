"""Draft projection audit — backtest the pre-draft projection methodology.

For a target season ``S``, reconstruct the pre-draft projection board exactly as
the Draft tab computes it (only using information available before the ``S``
draft), then compare against each player's actual fantasy points for season
``S``.

Also hosts ``build_projections``, the shared projection-assembly the web
endpoint uses, so the audit exercises the production code path rather than a
reimplementation.
"""

from __future__ import annotations

import csv
import math

from sqlalchemy import func

from elfant.db.models import League, Player, Draft, DraftPick, PlayerWeeklyStat
from elfant.scoring import fantasy_points
from elfant.sync.sync import _TEAM_ABBREVIATIONS
from elfant import projections as proj

SLEEPER_CDN = "https://sleepercdn.com"
PLAYER_IMG = f"{SLEEPER_CDN}/content/nfl/players"
TEAM_LOGO = f"{SLEEPER_CDN}/images/team_logos/nfl"

# Fraction of the league-average starter baseline an "unknown" player (no
# prior-season history, no rookie signal) is projected at. Most unknowns are
# backups/role players; the full starter baseline overprojects them.
_UNKNOWN_VOLUME_SCALE = 0.5

_OFF_STAT_KEYS = [
    "passing_yards", "passing_tds", "passing_interceptions", "passing_2pt_conversions",
    "rushing_yards", "rushing_tds", "rushing_2pt_conversions",
    "receptions", "receiving_yards", "receiving_tds", "receiving_2pt_conversions",
    "fumbles_lost",
]


def _build_opponent_strength(session, seasons: list[int], rules: dict) -> dict:
    """Build per-team opponent-strength ratings from prior-season weekly stats.

    Returns {"pass": {...}, "rush": {...}, "off": {...}} where each maps a team
    abbreviation (Sleeper format) → average fantasy points per game:
      - pass: points a defense allowed to opposing QBs/WRs/TEs (higher = easier
        schedule for pass-catchers and QBs).
      - rush: points a defense allowed to opposing RBs (higher = easier for RBs).
      - off:  a team's own offensive fantasy output (drives DEF scoring
        opportunities).

    All values are per-game averages across the given seasons, computed with the
    league's scoring rules.
    """
    pos_to_metric = {"QB": "pass", "WR": "pass", "TE": "pass", "RB": "rush"}

    # PlayerWeeklyStat has no position column — resolve it from the Player table.
    player_pos: dict[str, str] = {}
    for pl in session.query(Player).all():
        if pl.position in pos_to_metric:
            player_pos[pl.player_id] = pl.position

    pass_allowed: dict[str, list[float]] = {}
    rush_allowed: dict[str, list[float]] = {}
    off_output: dict[str, list[float]] = {}

    rows = (
        session.query(PlayerWeeklyStat)
        .filter(PlayerWeeklyStat.season.in_(seasons))
        .all()
    )
    for row in rows:
        if getattr(row, "season_type", "REG") not in (None, "REG", "regular"):
            continue
        # Team defenses are keyed by team abbreviation; skip them here.
        if row.player_id in _TEAM_ABBREVIATIONS:
            continue
        metric = pos_to_metric.get(player_pos.get(row.player_id))
        if not metric:
            continue
        opp = row.opponent
        team = row.team
        if not opp or not team:
            continue
        sd = {k: getattr(row, k, 0) or 0 for k in _OFF_STAT_KEYS}
        sd["special_teams_tds"] = row.special_teams_tds or 0
        sd["fumbles"] = 0
        fp = fantasy_points(sd, rules)
        if metric == "pass":
            pass_allowed.setdefault(opp, []).append(fp)
        elif metric == "rush":
            rush_allowed.setdefault(opp, []).append(fp)
        off_output.setdefault(team, []).append(fp)

    def _avg(d: dict) -> dict:
        return {t: round(sum(v) / len(v), 2) for t, v in d.items() if v}

    return {
        "pass": _avg(pass_allowed),
        "rush": _avg(rush_allowed),
        "off": _avg(off_output),
    }


def _target_schedule_opponents(season: int) -> dict[str, list[str]]:
    """Load a target season's schedule and map each team → its opponent slate."""
    _nf_to_sleeper = {"LA": "LAR", "OAK": "LV", "SD": "LAC", "STL": "LAR"}
    team_to_opponents: dict[str, list[str]] = {}
    try:
        import nflreadpy as nfl
        sched_df = nfl.load_schedules(seasons=[season])
        if sched_df is not None and not sched_df.is_empty():
            for row in sched_df.iter_rows(named=True):
                if row.get("week") is None or row.get("week") == 0:
                    continue
                if row.get("season_type") and row.get("season_type") not in (None, "REG", "regular"):
                    continue
                home = _nf_to_sleeper.get(row.get("home_team") or "", row.get("home_team") or "")
                away = _nf_to_sleeper.get(row.get("away_team") or "", row.get("away_team") or "")
                if not home or not away:
                    continue
                team_to_opponents.setdefault(home, []).append(away)
                team_to_opponents.setdefault(away, []).append(home)
    except Exception:
        pass
    return team_to_opponents


def _apply_point_in_time(
    player_map: dict[str, dict],
    rows: list,
    as_of_season: int | None,
    target_season: int,
) -> dict[str, dict]:
    """Adjust player context to what was known *before* the target season's draft.

    - team: most recent prior-season team from the weekly rows (not the current
      team in the Player table — a player who changed teams mid-career should be
      projected with the team he was on at the time);
    - age: back out the seasons elapsed between ``as_of_season`` (when the
      Player table's ages were captured) and ``target_season``.

    Returns a shallow-copied map so callers don't mutate the input.
    """
    latest: dict[str, tuple[int, int, str]] = {}
    for row in rows:
        pid = getattr(row, "player_id", None)
        if pid in _TEAM_ABBREVIATIONS:
            continue
        team = getattr(row, "team", None)
        if not team:
            continue
        key = (int(getattr(row, "season")), int(getattr(row, "week") or 0))
        cur = latest.get(pid)
        if cur is None or key > (cur[0], cur[1]):
            latest[pid] = (key[0], key[1], team)
    team_of = {pid: t for pid, (_, _, t) in latest.items()}

    years_elapsed = max(0, (as_of_season or target_season) - target_season)
    out: dict[str, dict] = {}
    for pid, pm in player_map.items():
        pm = dict(pm)
        if pid in team_of:
            pm["team"] = team_of[pid]
        if years_elapsed and pm.get("age"):
            pm["age"] = max(1, pm["age"] - years_elapsed)
        out[pid] = pm
    return out


def _data_as_of_season(session) -> int:
    """The season the stats/player tables currently reflect (max season present)."""
    max_season = session.query(func.max(PlayerWeeklyStat.season)).scalar()
    return int(max_season) if max_season else 0


def build_projections(
    session,
    league: League,
    target_season: int,
    position: str | None = None,
    point_in_time: bool = False,
    as_of_season: int | None = None,
    proj_options: dict | None = None,
) -> dict:
    """Compute the pre-draft projection board for ``target_season``.

    Replicates the Draft-tab endpoint: build per-player projections from
    prior-season usage + efficiency, apply a strength-of-schedule adjustment
    from the target season's schedule, and include rookies/unknowns with a
    role-adjusted baseline.

    With ``point_in_time=True`` the player context (team, age) is reconstructed
    from data available before the target season's draft, so the result is
    valid for backtesting a completed season.

    ``proj_options`` is an audit hook for backtesting alternative projection
    internals without touching production defaults:
      - ``def_method``: "avg" (default) | "recency" | "shrink"
      - ``confidence_weights``: 4-tuple blend for ``projection_confidence``
      - ``confidence_scaling``: multiplier k so projected points scale by
        ``1 + k * (confidence - 0.5)`` (vets/DEF only)
    """
    options = proj_options or {}
    def_method = options.get("def_method", "avg")
    rules = league.scoring_settings or {}
    prior_seasons = [target_season - i for i in range(1, 4) if target_season - i >= 2000]

    opponent_strength = _build_opponent_strength(session, prior_seasons, rules)

    player_map: dict[str, dict] = {}
    for pl in session.query(Player).all():
        player_map[pl.player_id] = {
            "name": f"{pl.first_name or ''} {pl.last_name or ''}".strip() or pl.player_id,
            "position": pl.position or "",
            "team": pl.team or "",
            "age": pl.age,
            "status": pl.status or "",
            "draft_round": pl.draft_round,
            "draft_ovr": pl.draft_ovr,
            "rookie_year": pl.rookie_year,
            "years_exp": pl.years_exp,
            "player_img": f"{PLAYER_IMG}/{pl.player_id}.jpg" if pl.player_id and pl.player_id.isdigit() else None,
            "team_logo": f"{TEAM_LOGO}/{pl.team.lower()}.png" if pl.team else None,
        }

    # Load all weekly stats for prior seasons in one bulk query.
    rows = (
        session.query(PlayerWeeklyStat)
        .filter(PlayerWeeklyStat.season.in_(prior_seasons))
        .order_by(PlayerWeeklyStat.player_id, PlayerWeeklyStat.season, PlayerWeeklyStat.week)
        .all()
    )

    if point_in_time:
        as_of = as_of_season if as_of_season is not None else int(league.season or target_season)
        player_map = _apply_point_in_time(player_map, rows, as_of, target_season)

    # Group rows by player.
    rows_by_player: dict[str, list] = {}
    for row in rows:
        rows_by_player.setdefault(row.player_id, []).append(row)

    # Derive per-position volume + efficiency baselines from this league's
    # own prior-season data (falls back to static defaults per-position).
    position_of = {pid: pm["position"] for pid, pm in player_map.items()}
    league_vol, league_eff = proj.league_baselines(rows_by_player, position_of)

    # League-average DEF fantasy points per game from prior-season rows —
    # baseline for the "shrink"/"avg" DEF projection variants.
    def_baseline = None
    if def_method in ("shrink", "avg"):
        def_fpg = []
        for pid, pr_rows in rows_by_player.items():
            if pid not in _TEAM_ABBREVIATIONS:
                continue
            for row in pr_rows:
                if getattr(row, "season_type", "REG") not in (None, "REG", "regular"):
                    continue
                def_fpg.append(fantasy_points(proj._row_to_statdict(row), rules))
        if def_fpg:
            def_baseline = sum(def_fpg) / len(def_fpg)

    # Track whether the target season's league has an existing draft with picks.
    has_draft = False
    for d in session.query(Draft).filter_by(league_id=league.league_id).all():
        has_picks = session.query(DraftPick).filter_by(draft_id=d.draft_id).first() is not None
        if has_picks:
            has_draft = True
            break

    # Load the target season's schedule to build each team's opponent slate.
    team_to_opponents = _target_schedule_opponents(target_season)

    projections = []
    team_volume_used: dict[tuple[str, str], dict[str, float]] = {}
    for pid, pr_rows in rows_by_player.items():
        pl = player_map.get(pid)
        if not pl or not pl["position"]:
            continue
        pos = pl["position"]
        team = pl["team"] or ""
        if not team:
            continue
        is_def = pos == "DEF"
        if is_def:
            res = proj.def_projection(
                pr_rows, rules,
                method=def_method,
                baseline=def_baseline,
            )
            projected_points = res["projected_points"]
            games = res["games"]
            confidence = res["confidence"]
            statline = {}
            usage = {}
            fpg_history = proj.season_fpg_history(pr_rows, rules)
            seasons_used = 0
        elif pos in proj.SKILL_POSITIONS:
            seasons = proj.build_season_stats(pr_rows)
            if not seasons:
                continue
            res = proj.project_statline(
                seasons, pos, pl["age"],
                volume_baseline=league_vol.get(pos),
                eff_baseline=league_eff.get(pos),
            )
            statline = res["statline"]
            games = res["games"]
            projected_points = round(proj.fantasy_projection(statline, rules), 1)
            fpg_history = proj.season_fpg_history(pr_rows, rules)
            # Confidence blends seasons covered, games played, data recency and
            # year-to-year FP/g consistency (volatility).
            confidence = proj.projection_confidence(
                seasons, [v for _, v in fpg_history], target_season,
                weights=options.get("confidence_weights"),
            )
            seasons_used = len(seasons)
            usage = {"games_played": games, "seasons_used": seasons_used}
        else:
            continue

        # Strength-of-schedule adjustment.
        base_points = projected_points
        conf_scale = options.get("confidence_scaling")
        if conf_scale:
            # Scale the point estimate by confidence: higher-confidence
            # projections get a slight boost (audit hook).
            base_points = base_points * (1.0 + conf_scale * (confidence - 0.5))
        if pos == "DEF":
            strength_map = opponent_strength.get("off", {})
        elif pos == "RB":
            strength_map = opponent_strength.get("rush", {})
        else:
            strength_map = opponent_strength.get("pass", {})
        opponents = team_to_opponents.get(team, [])
        factor = proj.sos_factor(opponents, strength_map, pos)
        projected_points = round(base_points * factor, 1)

        projections.append({
            "player_id": pid,
            "name": pl["name"],
            "position": pos,
            "team": team,
            "status": pl["status"],
            "age": pl["age"],
            "years_exp": pl["years_exp"],
            "player_img": pl["player_img"],
            "team_logo": f"{TEAM_LOGO}/{team.lower()}.png" if team else None,
            "projected_points": projected_points,
            "base_points": base_points,
            "sos_factor": round(factor, 3),
            "games": games,
            "confidence": confidence,
            "is_rookie": False,
            "kind": "vet",
            "draft_round": pl["draft_round"],
            "range_low": proj.range_band(base_points, pos, confidence)[0],
            "range_high": proj.range_band(base_points, pos, confidence)[1],
            "fpg_history": fpg_history,
            "statline": statline,
            "usage": usage,
        })

        # Track projected per-game volume per (team, position) so rookies on the
        # same team only get a share of the leftover role (team-share context).
        if pos in proj.SKILL_POSITIONS:
            budget = proj._TEAM_VOLUME_BUDGET.get(pos)
            if budget:
                used_vol = team_volume_used.setdefault((team, pos), {})
                pg = max(1, games)
                for metric in budget:
                    used_vol[metric] = used_vol.get(metric, 0.0) + (statline.get(metric, 0) or 0) / pg

    # Prior-season incumbent FP/g per (team, position) — used to infer how open
    # a role is for a rookie (the "role opportunity" signal).
    incumbent_fpg: dict[tuple[str, str], float] = {}
    for pid, pr_rows in rows_by_player.items():
        pl = player_map.get(pid)
        if not pl or not pl["team"] or not pl["position"]:
            continue
        if pl["position"] not in proj.SKILL_POSITIONS:
            continue
        fpg = proj.player_fpg(pr_rows, rules)
        if fpg <= 0:
            continue
        key = (pl["team"], pl["position"])
        incumbent_fpg[key] = max(incumbent_fpg.get(key, 0.0), fpg)

    # Include skill-position players with no prior-season history so they appear
    # on the pre-draft board. True rookies get a role-adjusted baseline; players
    # with no signal at all get the plain league-average baseline.
    projected_ids = {p["player_id"] for p in projections}
    for pid, pl in player_map.items():
        if pid in projected_ids:
            continue
        pos = pl["position"]
        if pos not in proj.SKILL_POSITIONS:
            continue
        if not pl["team"]:
            continue

        rookie_year = pl["rookie_year"]
        is_rookie = (
            (rookie_year is not None and rookie_year == target_season)
            or (pl["draft_round"] is not None and (pl["years_exp"] in (None, 0, 1)))
        )
        kind = "rookie" if is_rookie else "unknown"

        if is_rookie:
            opportunity = proj.role_opportunity(incumbent_fpg.get((pl["team"], pos)), pos)
            volume_scale = proj.rookie_volume_scale(opportunity, pl["draft_round"])
        else:
            # No role-opportunity haircut: an unknown player is treated as a
            # generic starter until we know otherwise — but only a half-starter
            # baseline, since most unknowns are backups/role players (the audit
            # shows full league-average volume overprojects them heavily).
            volume_scale = _UNKNOWN_VOLUME_SCALE

        # Team-share context: established players on the same team already claim
        # part of the position-group volume, so the rookie only gets leftover.
        used_vol = team_volume_used.get((pl["team"], pos), {})
        budget = proj._TEAM_VOLUME_BUDGET.get(pos, {})
        team_share = proj.team_share_factor(used_vol, budget)
        volume_scale *= max(0.0, 1.0 - team_share)

        res = proj.rookie_projection(
            pos, pl["age"], volume_scale=volume_scale,
            volume_baseline=league_vol.get(pos),
            eff_baseline=league_eff.get(pos),
        )
        statline = res["statline"]
        games = res["games"]
        base_points = round(proj.fantasy_projection(statline, rules), 1)
        strength_map = opponent_strength.get("rush" if pos == "RB" else "pass", {})
        opponents = team_to_opponents.get(pl["team"] or "", [])
        factor = proj.sos_factor(opponents, strength_map, pos)
        projected_points = round(base_points * factor, 1)

        if is_rookie:
            # Rookies get a wide prediction band: their role is uncertain.
            confidence = round(0.05 + 0.15 * proj.draft_capital_weight(pl["draft_round"]), 2)
        else:
            confidence = 0.2
        range_low, range_high = proj.range_band(base_points, pos, confidence)

        projections.append({
            "player_id": pid,
            "name": pl["name"],
            "position": pos,
            "team": pl["team"] or "",
            "status": pl["status"],
            "age": pl["age"],
            "years_exp": pl["years_exp"],
            "player_img": pl["player_img"],
            "team_logo": f"{TEAM_LOGO}/{(pl['team'] or '').lower()}.png" if pl["team"] else None,
            "projected_points": projected_points,
            "base_points": base_points,
            "sos_factor": round(factor, 3),
            "games": games,
            "confidence": confidence,
            "is_rookie": is_rookie,
            "kind": kind,
            "draft_round": pl["draft_round"],
            "range_low": range_low,
            "range_high": range_high,
            "fpg_history": [],
            "statline": statline,
            "usage": {"games_played": 0, "seasons_used": 0},
        })

    projections = proj.rank_projections(projections)
    if position:
        projections = [p for p in projections if p["position"] == position]

    # Replacement-level cutoff per position: the projected points at the last
    # starter slot (derived from the league's roster setup).
    position_ctx: dict[str, dict] = {}
    roster_positions = league.roster_positions or []
    for pos in proj.SKILL_POSITIONS + ("DEF",):
        starters = roster_positions.count(pos)
        if starters <= 0:
            continue
        pos_players = [p for p in projections if p["position"] == pos]
        if not pos_players:
            continue
        replacement = pos_players[min(starters, len(pos_players)) - 1]["projected_points"]
        position_ctx[pos] = {
            "starters": starters,
            "replacement": round(replacement, 1),
        }

    return {
        "season": target_season,
        "scoring_rules": rules,
        "has_draft": has_draft,
        "total_rosters": league.total_rosters or 0,
        "position_ctx": position_ctx,
        "players": projections,
    }


# ---------------------------------------------------------------------------
# Audit engine
# ---------------------------------------------------------------------------


def _chain(session, league_id: str) -> list:
    """The league's season chain, newest (given id) first."""
    league = session.get(League, league_id)
    if not league:
        return []
    chain = [league]
    seen = {league.league_id}
    cur = league
    while cur.previous_league_id and cur.previous_league_id not in seen:
        prev = session.get(League, cur.previous_league_id)
        if not prev:
            break
        chain.append(prev)
        seen.add(prev.league_id)
        cur = prev
    return chain


def league_for_season(session, league_id: str, season: int):
    """Find the league row in ``league_id``'s season chain for ``season``."""
    for lg in _chain(session, league_id):
        try:
            if int(lg.season) == int(season):
                return lg
        except (ValueError, TypeError):
            continue
    return None


def actual_season_points(weekly_rows: list, rules: dict, season: int) -> tuple[float, int]:
    """Total fantasy points (regular-season weeks) + games played for ``season``."""
    total = 0.0
    games = 0
    for row in weekly_rows:
        if getattr(row, "season_type", "REG") not in (None, "REG", "regular"):
            continue
        if int(getattr(row, "season")) != season:
            continue
        total += fantasy_points(proj._row_to_statdict(row), rules)
        games += 1
    return round(total, 2), games


def _pearson(xs: list[float], ys: list[float]) -> float | None:
    n = len(xs)
    if n < 2 or len(ys) != n:
        return None
    mx = sum(xs) / n
    my = sum(ys) / n
    cov = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    vx = sum((x - mx) ** 2 for x in xs)
    vy = sum((y - my) ** 2 for y in ys)
    if vx == 0 or vy == 0:
        return None
    return round(cov / math.sqrt(vx * vy), 4)


def _rank(values: list[float]) -> list[float]:
    """Average ranks (ties share the mean rank)."""
    order = sorted(range(len(values)), key=lambda i: values[i])
    ranks = [0.0] * len(values)
    i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and values[order[j + 1]] == values[order[i]]:
            j += 1
        avg = (i + j) / 2 + 1
        for k in range(i, j + 1):
            ranks[order[k]] = avg
        i = j + 1
    return ranks


def _spearman(xs: list[float], ys: list[float]) -> float | None:
    if len(xs) < 2 or len(xs) != len(ys):
        return None
    return _pearson(_rank(xs), _rank(ys))


def _metrics(pairs: list[tuple[float, float]]) -> dict:
    """Error metrics from (projected, actual) pairs."""
    n = len(pairs)
    if n == 0:
        return {}
    errors = [a - p for p, a in pairs]
    proj = [p for p, _ in pairs]
    act = [a for _, a in pairs]
    return {
        "n": n,
        "bias": round(sum(errors) / n, 2),
        "mae": round(sum(abs(e) for e in errors) / n, 2),
        "rmse": round(math.sqrt(sum(e * e for e in errors) / n), 2),
        "pearson": _pearson(proj, act),
        "spearman": _spearman(proj, act),
    }


def audit_league(
    session,
    league_id: str,
    seasons: list[int] | None,
    proj_options: dict | None = None,
) -> list[dict]:
    """Run the backtest for one league across target seasons.

    ``seasons`` of ``None`` defaults to the completed seasons in the league's
    chain — every chain season strictly before the newest (current) one.
    ``proj_options`` is passed through to ``build_projections`` (audit hook).

    Returns a list of per-season results::

        {"season": S,
         "league_id": <S league id>,
         "as_of_season": <max season in DB>,
         "players": [ {projection fields..., "actual_points", "actual_games", "error"}, ... ],
         "metrics": {overall + per-position + per-confidence-bucket + vet/rookie}}
    """
    as_of = _data_as_of_season(session)
    if seasons is None:
        chain = _chain(session, league_id)
        newest_season = None
        for lg in chain:
            try:
                newest_season = int(lg.season)
                break
            except (ValueError, TypeError):
                continue
        seasons = []
        for lg in chain:
            try:
                s = int(lg.season)
            except (ValueError, TypeError):
                continue
            if newest_season is None or s < newest_season:
                seasons.append(s)
    results = []
    for season in seasons:
        league = league_for_season(session, league_id, season)
        if league is None:
            continue
        board = build_projections(
            session, league, target_season=season,
            point_in_time=True, as_of_season=as_of, proj_options=proj_options,
        )
        rules = league.scoring_settings or {}

        # Load the season's weekly rows once, group by player.
        rows = (
            session.query(PlayerWeeklyStat)
            .filter(PlayerWeeklyStat.season == season)
            .all()
        )
        rows_by_player: dict[str, list] = {}
        for row in rows:
            rows_by_player.setdefault(row.player_id, []).append(row)

        player_rows = []
        for p in board["players"]:
            actual, actual_games = actual_season_points(
                rows_by_player.get(p["player_id"], []), rules, season
            )
            player_rows.append({
                **p,
                "actual_points": actual,
                "actual_games": actual_games,
                "error": round(actual - p["projected_points"], 2),
            })

        results.append({
            "season": season,
            "league_id": league.league_id,
            "as_of_season": as_of,
            "players": player_rows,
            "metrics": _season_metrics(player_rows),
        })
    return results


def _season_metrics(players: list[dict]) -> dict:
    """Overall + sliced diagnostics for one season's audit rows."""
    pairs = [(p["projected_points"], p["actual_points"]) for p in players]
    metrics = {"overall": _metrics(pairs)}

    by_pos: dict[str, list[tuple[float, float]]] = {}
    for p in players:
        by_pos.setdefault(p["position"], []).append((p["projected_points"], p["actual_points"]))
    metrics["by_position"] = {pos: _metrics(v) for pos, v in sorted(by_pos.items())}

    buckets = [("low", 0.0, 0.3), ("mid", 0.3, 0.5), ("high", 0.5, 0.7), ("very_high", 0.7, 1.01)]
    by_conf: dict[str, list[tuple[float, float]]] = {name: [] for name, _, _ in buckets}
    for p in players:
        for name, lo, hi in buckets:
            if lo <= p["confidence"] < hi:
                by_conf[name].append((p["projected_points"], p["actual_points"]))
                break
    metrics["by_confidence"] = {name: _metrics(v) for name, v in by_conf.items() if v}

    # Range calibration: does the actual land inside [range_low, range_high]?
    in_range = 0
    ranged = 0
    by_kind: dict[str, list[tuple[float, float]]] = {}
    for p in players:
        if p.get("range_low") is not None and p.get("range_high") is not None:
            ranged += 1
            if p["range_low"] <= p["actual_points"] <= p["range_high"]:
                in_range += 1
        by_kind.setdefault(p.get("kind", "unknown"), []).append(
            (p["projected_points"], p["actual_points"])
        )
    metrics["range_calibration"] = {
        "in_range": in_range,
        "ranged": ranged,
        "hit_rate": round(in_range / ranged, 3) if ranged else None,
    }
    metrics["by_kind"] = {kind: _metrics(v) for kind, v in sorted(by_kind.items())}

    # Games projected vs actual (injuries measured separately).
    games_pairs = [(p["games"], p["actual_games"]) for p in players if p.get("games") is not None]
    metrics["games"] = _metrics(games_pairs) if games_pairs else {}

    metrics["rank_hit_rate"] = {
        "top12": rank_hit_rate(players, 12),
        "top24": rank_hit_rate(players, 24),
    }
    return metrics


def rank_hit_rate(players: list[dict], top_n: int = 24) -> dict:
    """Per-position overlap between the projected top-N and the actual top-N.

    Returns ``{position: {"n", "overlap", "hit_rate"}}`` for positions with at
    least four players. Positions with fewer than ``top_n`` players use their
    full count.
    """
    by_pos: dict[str, list[dict]] = {}
    for p in players:
        by_pos.setdefault(p["position"], []).append(p)
    out: dict[str, dict] = {}
    for pos, rs in sorted(by_pos.items()):
        k = min(top_n, len(rs))
        if k < 4:
            continue
        proj_top = {p["player_id"] for p in sorted(rs, key=lambda r: -r["projected_points"])[:k]}
        act_top = {p["player_id"] for p in sorted(rs, key=lambda r: -r["actual_points"])[:k]}
        overlap = len(proj_top & act_top)
        out[pos] = {"n": k, "overlap": overlap, "hit_rate": round(overlap / k, 3)}
    return out


def _average_rank_hit_rate(results: list[dict]) -> dict:
    """Average each position's per-season rank hit-rate across seasons.

    Pooling rows across seasons would conflate different years (the same player
    appears once per season), so the correct multi-season number is the mean of
    the per-season hit-rates.
    """
    out: dict[str, dict] = {"top12": {}, "top24": {}}
    for level in out:
        pos_rates: dict[str, list[float]] = {}
        for res in results:
            table = (res.get("metrics") or {}).get("rank_hit_rate", {}).get(level, {})
            for pos, v in table.items():
                pos_rates.setdefault(pos, []).append(v["hit_rate"])
        for pos, rates in pos_rates.items():
            out[level][pos] = {
                "avg": round(sum(rates) / len(rates), 3),
                "seasons": len(rates),
            }
    return out


def pooled_metrics(results: list[dict]) -> dict:
    """Aggregate metrics across season results.

    Pooled rows for overall/by-position/confidence/ranges/games (each
    player-season is an independent observation), but rank hit-rate averaged
    per season rather than recomputed on pooled rows.
    """
    all_players = [p for res in results for p in res["players"]]
    metrics = _season_metrics(all_players)
    metrics["rank_hit_rate"] = _average_rank_hit_rate(results)
    return metrics


_STAT_FEATURE_KEYS = [
    "attempts", "carries", "targets", "receptions",
    "passing_yards", "rushing_yards", "receiving_yards",
    "passing_tds", "rushing_tds", "receiving_tds",
]


def write_csv(players: list[dict], path: str) -> str:
    """Write an audit season's player rows to a CSV, returning the path.

    Includes the projection feature columns (age, seasons used, statline volume
    and yards) so the CSV doubles as a dataset for the calibration step.
    """
    fields = [
        "player_id", "name", "position", "team", "kind", "is_rookie", "draft_round",
        "age", "years_exp", "seasons_used",
        "projected_points", "base_points", "sos_factor", "games", "confidence",
        "range_low", "range_high", "actual_points", "actual_games", "error",
    ] + _STAT_FEATURE_KEYS
    with open(path, "w", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fields)
        writer.writeheader()
        for p in players:
            row = {f: p.get(f) for f in fields}
            stat = p.get("statline") or {}
            for key in _STAT_FEATURE_KEYS:
                row[key] = stat.get(key, 0)
            usage = p.get("usage") or {}
            row["seasons_used"] = usage.get("seasons_used", 0)
            writer.writerow(row)
    return path