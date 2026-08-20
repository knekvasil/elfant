"""Homemade draft projections — build player season projections from recent
per-season usage + efficiency, then convert to fantasy points via scoring.py.

No ML: player-season samples are small and noisy, so we use weighted trailing
averages with shrinkage toward a position baseline, plus position-specific age
curves and a games-played expectation. The result feeds the same raw stat-line
shape that ``elfant.scoring.fantasy_points`` consumes, so projections are always
consistent with a league's scoring rules.
"""

from __future__ import annotations

from dataclasses import dataclass

from elfant.scoring import fantasy_points

# Position we care about for projections (DEF handled separately from team stats).
SKILL_POSITIONS = ("QB", "RB", "WR", "TE", "K")

# Recency weights across the trailing seasons (index 0 = most recent).
RECENCY_WEIGHTS = (0.5, 0.3, 0.2)

# Strength-of-schedule: position → (strength metric, weight).
#  - pass: opponent pass-defense strength (fantasy pts a defense allows to
#    pass-catchers/QB). Applies to QBs, WRs, TEs.
#  - rush: opponent run-defense strength. Applies to RBs (run D is more stable,
#    so weight is small).
#  - off:  opponent's own offensive output — drives DEF scoring opportunities
#    (more opponent plays → more sacks/INTs). Applies to DEF, weighted highest.
#  - None: no schedule adjustment (kickers).
_POS_SOS: dict[str, tuple[str | None, float]] = {
    "QB": ("pass", 0.6),
    "WR": ("pass", 0.5),
    "TE": ("pass", 0.5),
    "RB": ("rush", 0.3),
    "K": (None, 0.0),
    "DEF": ("off", 0.7),
}

# Cap on the schedule-favorability multiplier (e.g. ±8%). SoS is a secondary
# refinement; keeping it modest avoids reordering ranks on noisy schedule data.
_SOS_MAX_FACTOR = 0.08


def sos_factor(
    opponents: list[str],
    strength_map: dict[str, float],
    position: str,
) -> float:
    """Compute a schedule-favorability multiplier from a team's opponent slate.

    ``opponents`` is the team's list of opponent abbreviations (Sleeper format).
    ``strength_map`` maps team abbreviation → a per-game fantasy rating in the
    units that make an easier schedule produce a higher value:
      - for skill positions: fantasy points a defense *allows* to that position
        group (higher = easier opponent).
      - for DEF: the opponent's own offensive output (higher = more plays and
        scoring opportunities for our DEF).

    Returns a multiplier centered on 1.0 (neutral schedule), clamped within
    ±``_SOS_MAX_FACTOR``. Positions with no adjustment (K) always return 1.0.
    """
    metric, weight = _POS_SOS.get(position, (None, 0.0))
    if metric is None or not opponents or not strength_map:
        return 1.0

    ratings = [strength_map[o] for o in opponents if o in strength_map]
    if not ratings:
        return 1.0

    baseline_vals = [v for v in strength_map.values() if v is not None]
    if not baseline_vals:
        return 1.0
    baseline = sum(baseline_vals) / len(baseline_vals)
    if baseline <= 0:
        return 1.0

    avg = sum(ratings) / len(ratings)
    # Positive ratio → easier-than-average schedule.
    ratio = avg / baseline - 1.0
    factor = 1.0 + ratio * weight
    return max(1.0 - _SOS_MAX_FACTOR, min(1.0 + _SOS_MAX_FACTOR, factor))


def _shrink(value: float, baseline: float, weight: float) -> float:
    """Pull a per-game value toward a position baseline.

    weight in [0, 1] represents confidence in the observed value (more games /
    more recent data → higher). Shrinkage prevents tiny samples from producing
    wild projections.
    """
    return value * weight + baseline * (1 - weight)


@dataclass
class AgeCurve:
    """Multiplier applied to per-game usage/efficiency by player age.

    Peak ages per position, with gentle decay after. Values are heuristic but
    calibrated to well-known positional aging curves.
    """
    peak: tuple[int, int]  # inclusive age range of full value
    decline_per_year: float  # multiplier lost per year past peak

    def factor(self, age: int | None) -> float:
        if not age:
            return 1.0
        peak_lo, peak_hi = self.peak
        if peak_lo <= age <= peak_hi:
            return 1.0
        if age < peak_lo:
            # Young players improving toward peak — mild ramp.
            ramp = 1.0 + 0.03 * (peak_lo - age)
            return min(ramp, 1.12)
        # Past peak: decay.
        years_past = age - peak_hi
        return max(0.5, 1.0 - self.decline_per_year * years_past)


AGE_CURVES: dict[str, AgeCurve] = {
    "QB": AgeCurve((27, 33), 0.05),
    "RB": AgeCurve((24, 27), 0.14),
    "WR": AgeCurve((25, 29), 0.06),
    "TE": AgeCurve((26, 30), 0.07),
    "K": AgeCurve((26, 35), 0.04),
}

# Position baselines used for shrinkage.
#  - volume metrics (carries, targets, attempts, FG/PAT attempts) shrink toward
#    a league-average baseline.
#  - efficiency/rate metrics (TD rate, YPC, YPT, catch rate, ...) shrink toward a
#    top-quartile baseline and are shrunk less aggressively, because elite
#    efficiency is the key differentiator we want to preserve.
_POS_BASELINE = {
    "QB": {"attempts": 34.0},
    "RB": {"carries": 12.0, "targets": 3.0},
    "WR": {"targets": 8.0},
    "TE": {"targets": 5.5},
    "K": {"fg_made": 1.7, "pat_made": 2.4},
}

# Efficiency/rate metrics per position (all other keys in a position's extractor
# are treated as volume). Each value is the top-quartile baseline for shrinkage.
_POS_EFFICIENCY_BASELINE = {
    "QB": {"comp_pct": 0.66, "yards_per_att": 7.6, "td_pct": 0.05, "int_pct": 0.018},
    "RB": {"yards_per_carry": 4.5, "rush_td_rate": 0.025, "catch_rate": 0.78, "yards_per_target": 6.8},
    "WR": {"catch_rate": 0.67, "yards_per_target": 8.8, "td_per_target": 0.065},
    "TE": {"catch_rate": 0.72, "yards_per_target": 7.8, "td_per_target": 0.06},
}

# Number of games-equivalent of recent history needed to reach full confidence
# in a player's observed rates (lower = workhorses trust their numbers sooner).
_CONF_GAMES_CEILING = 16

# Efficiency metrics are never shrunk below this fraction toward the baseline,
# even at low confidence. This preserves elite players' efficiency instead of
# mean-reverting it all the way to league/top-quartile average.
_EFFICIENCY_MIN_TRUST = 0.7

# Default games expected (of 17) when no history is available.
DEFAULT_GAMES = 15


def games_expected(seasons: list[dict]) -> int:
    """Expected games played (0..17) from recent seasons' games played."""
    if not seasons:
        return DEFAULT_GAMES
    recent = seasons[: min(len(seasons), 3)]
    avg_games = sum(s.get("games", 0) for s in recent) / len(recent)
    # Slight regression toward the middle to avoid over-penalizing injuries.
    expected = round(avg_games * 0.9 + DEFAULT_GAMES * 0.1)
    return max(0, min(17, expected))


def _per_game(s: dict, keys: list[str]) -> dict:
    """Divide a set of season raw totals by games played to get per-game values."""
    games = s.get("games") or 0
    out: dict[str, float] = {}
    for key in keys:
        val = s.get(key) or 0
        out[key] = (val / games) if games else 0.0
    return out


def _extract_qb(s: dict) -> dict:
    g = _per_game(s, ["attempts", "completions", "passing_yards", "passing_tds", "passing_interceptions"])
    attempts = g["attempts"]
    return {
        "attempts": attempts,
        "comp_pct": (g["completions"] / attempts) if attempts else 0,
        "yards_per_att": (g["passing_yards"] / attempts) if attempts else 0,
        "td_pct": (g["passing_tds"] / attempts) if attempts else 0,
        "int_pct": (g["passing_interceptions"] / attempts) if attempts else 0,
    }


def _extract_rb(s: dict) -> dict:
    g = _per_game(s, ["carries", "rushing_yards", "rushing_tds", "targets", "receptions", "receiving_yards"])
    carries = g["carries"]
    targets = g["targets"]
    return {
        "carries": carries,
        "yards_per_carry": (g["rushing_yards"] / carries) if carries else 0,
        "rush_td_rate": (g["rushing_tds"] / carries) if carries else 0,
        "targets": targets,
        "catch_rate": (g["receptions"] / targets) if targets else 0,
        "yards_per_target": (g["receiving_yards"] / targets) if targets else 0,
    }


def _extract_wr_te(s: dict) -> dict:
    g = _per_game(s, ["targets", "receptions", "receiving_yards", "receiving_tds"])
    targets = g["targets"]
    return {
        "targets": targets,
        "catch_rate": (g["receptions"] / targets) if targets else 0,
        "yards_per_target": (g["receiving_yards"] / targets) if targets else 0,
        "td_per_target": (g["receiving_tds"] / targets) if targets else 0,
    }


def _extract_k(s: dict) -> dict:
    g = _per_game(s, ["fg_made", "pat_made"])
    return {"fg_made": g["fg_made"], "pat_made": g["pat_made"]}


_EXTRACTORS = {
    "QB": _extract_qb,
    "RB": _extract_rb,
    "WR": _extract_wr_te,
    "TE": _extract_wr_te,
    "K": _extract_k,
}


def _project_usage(seasons: list[dict], position: str, age: int | None) -> dict:
    """Project per-game usage/efficiency metrics from trailing seasons.

    ``seasons`` is a list of per-season dicts in chronological order (oldest
    first); we weight the most recent seasons most heavily and shrink toward
    position baselines.

    Volume metrics (carries, targets, attempts) shrink toward a league-average
    baseline, while efficiency/rate metrics (TD rate, YPC, YPT, catch rate)
    shrink toward a top-quartile baseline and are preserved more aggressively so
    elite players don't get mean-reverted into mediocrity.
    """
    extract = _EXTRACTORS.get(position)
    if not extract:
        return {}

    volume_baseline = _POS_BASELINE.get(position, {})
    eff_baseline = _POS_EFFICIENCY_BASELINE.get(position, {})
    metrics = [extract(s) for s in seasons]
    # Weights grow with recency (most recent = last in the oldest-first list);
    # also weight by games played that season.
    n = len(metrics)
    # All metric keys the extractor can produce.
    all_keys = set(volume_baseline) | set(eff_baseline) | (
        set(metrics[0]) if metrics else set()
    )
    weighted: dict[str, float] = {}
    for key in all_keys:
        values = []
        for i, m in enumerate(metrics):
            games = seasons[i].get("games") or 0
            recency_idx = min(n - 1 - i, len(RECENCY_WEIGHTS) - 1)
            recency_w = RECENCY_WEIGHTS[recency_idx]
            values.append((m.get(key, 0.0), recency_w * games))
        total_w = sum(w for _, w in values) or 1.0
        raw = sum(v * w for v, w in values) / total_w
        # Shrink with confidence proportional to total recent games observed.
        conf = min(1.0, total_w / _CONF_GAMES_CEILING)

        if key in eff_baseline:
            # Efficiency: shrink toward the top-quartile baseline, and never
            # below the trust floor — preserve elite efficiency.
            weight = _EFFICIENCY_MIN_TRUST + (1 - _EFFICIENCY_MIN_TRUST) * conf
            weighted[key] = _shrink(raw, eff_baseline[key], weight)
        else:
            # Volume: shrink toward league-average baseline with full confidence.
            baseline = volume_baseline.get(key, 0.0)
            weighted[key] = _shrink(raw, baseline, conf)

    age_curve = AGE_CURVES.get(position)
    if age_curve:
        f = age_curve.factor(age)
        for key in weighted:
            weighted[key] *= f
    return weighted


def project_statline(seasons: list[dict], position: str, age: int | None) -> dict:
    """Build a full season stat-line dict (per the raw-stat keys that
    ``fantasy_points`` consumes) from projected per-game usage/efficiency.

    Returns a dict with the season's total stats ready for scoring.py, plus the
    projected games played.
    """
    usage = _project_usage(seasons, position, age)
    games = games_expected(seasons)

    if position == "QB":
        attempts = usage.get("attempts", 0) * games
        statline = {
            "attempts": round(attempts),
            "completions": round(attempts * usage.get("comp_pct", 0)),
            "passing_yards": round(attempts * usage.get("yards_per_att", 0)),
            "passing_tds": round(attempts * usage.get("td_pct", 0)),
            "passing_interceptions": round(attempts * usage.get("int_pct", 0)),
        }
    elif position == "RB":
        carries = usage.get("carries", 0) * games
        targets = usage.get("targets", 0) * games
        rec = targets * usage.get("catch_rate", 0)
        statline = {
            "carries": round(carries),
            "rushing_yards": round(carries * usage.get("yards_per_carry", 0)),
            "rushing_tds": round(carries * usage.get("rush_td_rate", 0)),
            "targets": round(targets),
            "receptions": round(rec),
            "receiving_yards": round(targets * usage.get("yards_per_target", 0)),
        }
    elif position in ("WR", "TE"):
        targets = usage.get("targets", 0) * games
        rec = targets * usage.get("catch_rate", 0)
        statline = {
            "targets": round(targets),
            "receptions": round(rec),
            "receiving_yards": round(targets * usage.get("yards_per_target", 0)),
            "receiving_tds": round(targets * usage.get("td_per_target", 0)),
        }
    elif position == "K":
        statline = {
            "fg_made": round(usage.get("fg_made", 0) * games),
            "pat_made": round(usage.get("pat_made", 0) * games),
        }
    else:
        statline = {}

    return {"statline": statline, "games": games}


def rookie_projection(position: str, age: int | None) -> dict:
    """Produce a league-average baseline projection for a rookie with no
    prior-season history.

    Uses the same position volume + efficiency baselines that the shrinkage
    logic pulls established players toward, scaled to a default season, and
    applies the position age curve. Returns the same shape as
    ``project_statline``: ``{"statline": ..., "games": ...}``.
    """
    volume = _POS_BASELINE.get(position, {})
    eff = _POS_EFFICIENCY_BASELINE.get(position, {})
    games = DEFAULT_GAMES

    age_curve = AGE_CURVES.get(position)
    f = age_curve.factor(age) if age_curve else 1.0

    usage: dict[str, float] = {}
    for k, v in volume.items():
        usage[k] = v * f
    for k, v in eff.items():
        usage[k] = v

    if position == "QB":
        attempts = usage.get("attempts", 0) * games
        statline = {
            "attempts": round(attempts),
            "completions": round(attempts * usage.get("comp_pct", 0)),
            "passing_yards": round(attempts * usage.get("yards_per_att", 0)),
            "passing_tds": round(attempts * usage.get("td_pct", 0)),
            "passing_interceptions": round(attempts * usage.get("int_pct", 0)),
        }
    elif position == "RB":
        carries = usage.get("carries", 0) * games
        targets = usage.get("targets", 0) * games
        rec = targets * usage.get("catch_rate", 0)
        statline = {
            "carries": round(carries),
            "rushing_yards": round(carries * usage.get("yards_per_carry", 0)),
            "rushing_tds": round(carries * usage.get("rush_td_rate", 0)),
            "targets": round(targets),
            "receptions": round(rec),
            "receiving_yards": round(targets * usage.get("yards_per_target", 0)),
        }
    elif position in ("WR", "TE"):
        targets = usage.get("targets", 0) * games
        rec = targets * usage.get("catch_rate", 0)
        statline = {
            "targets": round(targets),
            "receptions": round(rec),
            "receiving_yards": round(targets * usage.get("yards_per_target", 0)),
            "receiving_tds": round(targets * usage.get("td_per_target", 0)),
        }
    elif position == "K":
        statline = {
            "fg_made": round(usage.get("fg_made", 0) * games),
            "pat_made": round(usage.get("pat_made", 0) * games),
        }
    else:
        statline = {}

    return {"statline": statline, "games": games}


def fantasy_projection(statline: dict, rules: dict) -> float:
    """Convert a season stat-line to projected fantasy points.

    ``statline`` is the raw-stat dict (per-game-free, already scaled to a
    season); scoring.py handles the per-unit multipliers. Kick/DEF bucket bonuses
    (pts_allowed etc.) aren't part of the projection statline, so this is a
    straight sum of the unit multipliers.
    """
    return fantasy_points(statline, rules)


# Raw stat keys summed across a season (used for building season aggregates).
_SUM_STAT_KEYS = [
    "completions", "attempts", "passing_yards", "passing_tds",
    "passing_interceptions", "carries", "rushing_yards", "rushing_tds",
    "receptions", "targets", "receiving_yards", "receiving_tds",
    "fg_made", "fg_att", "fg_made_0_19", "fg_made_20_29", "fg_made_30_39",
    "fg_made_40_49", "fg_made_50_59", "fg_made_60_", "pat_made", "pat_att",
]


def build_season_stats(weekly_rows: list) -> list[dict]:
    """Aggregate a list of weekly stat rows into per-season stat dicts.

    ``weekly_rows`` are objects with a ``season``, ``week`` and the raw stat
    attributes (SQLAlchemy PlayerWeeklyStat instances, or any object exposing
    the same attributes). Returns a list of per-season dicts in ascending
    season order, each shaped like::

        {"season": 2024, "games": 14,
         "attempts": 480, "completions": ..., ...}

    Only regular-season weeks count toward games played. The season dict uses
    the same key names as the raw stat columns.
    """
    by_season: dict[int, dict] = {}
    for row in weekly_rows:
        if getattr(row, "season_type", "REG") not in (None, "REG", "regular"):
            continue
        season = int(getattr(row, "season"))
        s = by_season.setdefault(season, {"season": season, "games": 0})
        for key in _SUM_STAT_KEYS:
            val = getattr(row, key, None)
            if val:
                s[key] = s.get(key, 0) + val
        s["games"] += 1

    return [by_season[s] for s in sorted(by_season)]


def def_projection(weekly_rows: list, rules: dict, age: int | None = None) -> dict:
    """Project a team DEF's season fantasy points.

    DEF scoring relies on per-game bucket bonuses (pts_allowed, yds_allowed)
    that can't be reconstructed from a season total, so we compute fantasy
    points per game via scoring.py on each weekly row, then take a recency-
    weighted average and scale by games expected.

    Returns a dict with ``projected_points`` and ``games``.
    """
    # Group weekly rows by season, keep only regular-season weeks.
    by_season: dict[int, list] = {}
    for row in weekly_rows:
        if getattr(row, "season_type", "REG") not in (None, "REG", "regular"):
            continue
        by_season.setdefault(int(getattr(row, "season")), []).append(row)

    seasons = sorted(by_season.keys())
    # Per-game points by season, oldest first.
    fp_per_game: list[tuple[int, float]] = []
    for season in seasons:
        rows = by_season[season]
        if not rows:
            continue
        games = len(rows)
        total = sum(fantasy_points(_row_to_statdict(r), rules) for r in rows)
        fp_per_game.append((games, total / games))

    if not fp_per_game:
        return {"projected_points": 0.0, "games": DEFAULT_GAMES, "confidence": 0.0}

    # Recency-weighted average (recent seasons weigh more). fp_per_game is
    # oldest-first, so the last element is most recent.
    n = len(fp_per_game)
    weights = [RECENCY_WEIGHTS[min(n - 1 - i, len(RECENCY_WEIGHTS) - 1)] for i in range(n)]
    total_w = sum(g * w for (g, _), w in zip(fp_per_game, weights))
    weighted = (
        sum(g * w * v for (g, v), w in zip(fp_per_game, weights)) / total_w
        if total_w
        else 0.0
    )

    games = games_expected([{"games": g} for g, _ in fp_per_game])
    conf = min(1.0, len(fp_per_game) / 3.0)
    return {"projected_points": round(weighted * games, 1), "games": games, "confidence": round(conf, 2)}


_DEF_ROW_KEYS = [
    "def_sacks", "def_interceptions", "def_tackles_solo", "def_tackles_with_assist",
    "def_tackles_for_loss", "def_tds", "def_safeties", "def_fumbles_forced",
    "def_pass_defended", "special_teams_tds", "pts_allowed", "yds_allowed",
    "fg_missed", "pat_missed", "fg_blocked", "pat_blocked", "punt_blocked",
    "fumble_recovery_opp", "fumble_recovery_tds", "fg_yds_bonus",
    "def_4_and_stop", "def_3_and_out", "kicks_blocked",
]


def _row_to_statdict(row) -> dict:
    """Convert a PlayerWeeklyStat row to the raw-stat dict scoring.py expects."""
    return {key: getattr(row, key, 0) or 0 for key in _DEF_ROW_KEYS}


def rank_projections(players: list[dict]) -> list[dict]:
    players = sorted(players, key=lambda p: -p.get("projected_points", 0))
    for i, p in enumerate(players):
        p["overall_rank"] = i + 1
    from collections import defaultdict

    pos_counter: dict[str, int] = defaultdict(int)
    for p in players:
        pos_counter[p["position"]] += 1
        p["position_rank"] = pos_counter[p["position"]]
    return players
