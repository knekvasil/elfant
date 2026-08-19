import pytest

from elfant import projections as p
from elfant.scoring import fantasy_points


def _mk_row(season, week, **kw):
    """Build a minimal object that behaves like a PlayerWeeklyStat row."""
    class R:
        pass
    r = R()
    r.season = season
    r.week = week
    r.season_type = "REG"
    for k, v in kw.items():
        setattr(r, k, v)
    return r


def test_shrink():
    # Full confidence → observed value; zero confidence → baseline.
    assert p._shrink(20.0, 10.0, 1.0) == 20.0
    assert p._shrink(20.0, 10.0, 0.0) == 10.0
    assert p._shrink(20.0, 10.0, 0.5) == 15.0


def test_age_curve_in_peak():
    c = p.AgeCurve((24, 27), 0.14)
    assert c.factor(26) == 1.0
    assert c.factor(30) == pytest.approx(1 - 0.14 * 3)
    assert c.factor(20) > 1.0


def test_games_expected_rounds_to_17_cap():
    assert p.games_expected([]) == p.DEFAULT_GAMES
    assert p.games_expected([{"games": 16}, {"games": 17}]) <= 17
    assert p.games_expected([{"games": 17}, {"games": 17}]) == 17


def test_build_season_stats_regular_only():
    rows = [
        _mk_row(2023, 1, attempts=30, completions=20),
        _mk_row(2023, 2, attempts=25, completions=15),
        _mk_row(2024, 1, attempts=40, completions=28, season_type="POST"),
        _mk_row(2024, 2, attempts=35, completions=22),
    ]
    seasons = p.build_season_stats(rows)
    assert len(seasons) == 2
    s23 = seasons[0]
    assert s23["season"] == 2023
    assert s23["games"] == 2
    assert s23["attempts"] == 55
    s24 = seasons[1]
    assert s24["games"] == 1  # only REG week counted
    assert s24["attempts"] == 35


def test_rb_statline_realistic():
    seasons = [
        {"season": 2022, "games": 15, "carries": 220, "rushing_yards": 950, "rushing_tds": 8, "targets": 50, "receptions": 36, "receiving_yards": 280},
        {"season": 2023, "games": 16, "carries": 250, "rushing_yards": 1100, "rushing_tds": 9, "targets": 60, "receptions": 45, "receiving_yards": 350},
        {"season": 2024, "games": 14, "carries": 230, "rushing_yards": 1020, "rushing_tds": 7, "targets": 55, "receptions": 40, "receiving_yards": 320},
    ]
    out = p.project_statline(seasons, "RB", 26)
    sl = out["statline"]
    assert 150 < sl["carries"] < 260
    assert 600 < sl["rushing_yards"] < 1200
    assert sl["rushing_tds"] >= 1
    rules = {"rush_yd": 0.1, "rush_td": 6, "rec": 1, "rec_yd": 0.1, "rec_td": 6}
    pts = p.fantasy_projection(sl, rules)
    assert 100 < pts < 300


def test_qb_statline_realistic():
    seasons = [
        {"season": 2023, "games": 17, "attempts": 600, "completions": 400, "passing_yards": 4500, "passing_tds": 35, "passing_interceptions": 10},
        {"season": 2024, "games": 16, "attempts": 580, "completions": 390, "passing_yards": 4400, "passing_tds": 33, "passing_interceptions": 12},
    ]
    out = p.project_statline(seasons, "QB", 30)
    sl = out["statline"]
    assert 400 < sl["attempts"] < 650
    assert 3000 < sl["passing_yards"] < 5500
    rules = {"pass_yd": 0.04, "pass_td": 4, "pass_int": -1}
    assert 200 < p.fantasy_projection(sl, rules) < 400


def test_project_usage_weights_recent_more():
    # A strong recent season should pull the projection up more than a weak one.
    weak_recent = [
        {"season": 2023, "games": 16, "carries": 250, "rushing_yards": 1100, "rushing_tds": 9, "targets": 60, "receptions": 45, "receiving_yards": 350},
        {"season": 2024, "games": 14, "carries": 120, "rushing_yards": 400, "rushing_tds": 3, "targets": 30, "receptions": 18, "receiving_yards": 140},
    ]
    strong_recent = [
        {"season": 2023, "games": 16, "carries": 120, "rushing_yards": 400, "rushing_tds": 3, "targets": 30, "receptions": 18, "receiving_yards": 140},
        {"season": 2024, "games": 14, "carries": 250, "rushing_yards": 1100, "rushing_tds": 9, "targets": 60, "receptions": 45, "receiving_yards": 350},
    ]
    u1 = p._project_usage(weak_recent, "RB", 26)
    u2 = p._project_usage(strong_recent, "RB", 26)
    assert u2["carries"] > u1["carries"]
    assert u2["targets"] > u1["targets"]


def test_k_statline_scores_points():
    k = [
        {"season": 2023, "games": 17, "fg_made": 28, "pat_made": 40},
        {"season": 2024, "games": 16, "fg_made": 26, "pat_made": 38},
    ]
    out = p.project_statline(k, "K", 30)
    sl = out["statline"]
    assert 20 < sl["fg_made"] < 35
    assert 30 < sl["pat_made"] < 45
    pts = p.fantasy_projection(sl, {"fgm": 3, "xpm": 1})
    assert 100 < pts < 160


def test_elite_efficiency_preserved():
    # Regression guard: an elite recent season (11 rush TD) should not be
    # mean-reverted all the way down to a league-average TD total.
    bijan = [
        {"season": 2023, "games": 15, "carries": 214, "rushing_yards": 976, "rushing_tds": 4, "targets": 58, "receptions": 43, "receiving_yards": 340},
        {"season": 2024, "games": 17, "carries": 304, "rushing_yards": 1456, "rushing_tds": 11, "targets": 70, "receptions": 55, "receiving_yards": 473},
    ]
    out = p.project_statline(bijan, "RB", 22)
    # A top-2 RB should project well above league-average volume and keep a
    # healthy TD total (previously it collapsed to ~4-5).
    assert out["statline"]["carries"] >= 240
    assert out["statline"]["rushing_tds"] >= 8
    assert out["statline"]["rushing_yards"] >= 1100


def test_thin_sample_more_conservative():
    # A single, modest season should be trusted less than an established star.
    thin = [
        {"season": 2024, "games": 12, "carries": 150, "rushing_yards": 600, "rushing_tds": 5, "targets": 30, "receptions": 20, "receiving_yards": 160},
    ]
    out = p.project_statline(thin, "RB", 23)
    # Regress toward baseline: volume shouldn't balloon above the modest observed
    # workload, but shouldn't crater either.
    assert 120 <= out["statline"]["carries"] <= 220


def test_rank_projections():
    players = [
        {"player_id": "a", "position": "RB", "projected_points": 200},
        {"player_id": "b", "position": "QB", "projected_points": 300},
        {"player_id": "c", "position": "RB", "projected_points": 150},
    ]
    ranked = p.rank_projections(players)
    assert ranked[0]["player_id"] == "b"  # QB 300 top overall
    assert ranked[0]["overall_rank"] == 1
    by_id = {x["player_id"]: x for x in ranked}
    assert by_id["b"]["position_rank"] == 1
    assert by_id["a"]["position_rank"] == 1  # top RB
    assert by_id["c"]["position_rank"] == 2


def test_def_projection():
    rules = {"sack": 1, "int": 2, "def_td": 6, "safe": 2, "ff": 1, "pts_allow_0": 10, "pts_allow_1_6": 7, "pts_allow_7_13": 4, "pts_allow_14_20": 1, "pts_allow_21_27": 0, "pts_allow_28_34": -1, "pts_allow_35p": -4}
    rows = []
    for season in (2023, 2024):
        for w in range(1, 17):
            rows.append(_mk_row(season, w, def_sacks=3, def_interceptions=1, pts_allowed=17))
    out = p.def_projection(rows, rules)
    assert out["projected_points"] > 50
    assert out["games"] > 0


def test_statline_feeds_scoring_engine():
    # The projected statline must be consumable by fantasy_points.
    sl = {"carries": 200, "rushing_yards": 850, "rushing_tds": 6, "targets": 50, "receptions": 38, "receiving_yards": 300, "receiving_tds": 2}
    pts = fantasy_points(sl, {"rush_yd": 0.1, "rush_td": 6, "rec": 1, "rec_yd": 0.1, "rec_td": 6})
    assert pts > 100
