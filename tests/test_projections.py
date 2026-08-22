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


def test_sos_factor_neutral_slate():
    # A schedule matching the league-average baseline → factor ~1.0.
    strength = {"A": 10.0, "B": 10.0, "C": 10.0, "D": 10.0}
    factor = p.sos_factor(["A", "B", "C"], strength, "QB")
    assert factor == pytest.approx(1.0)


def test_sos_factor_easy_schedule_boosts():
    # Opponents that allow more points (higher rating) → easier schedule → >1.
    strength = {"A": 12.0, "B": 13.0, "C": 11.0, "D": 8.0}
    factor = p.sos_factor(["A", "B", "C"], strength, "QB")
    assert factor > 1.0
    # A hard schedule (low ratings) → <1.
    hard = p.sos_factor(["D", "D", "D"], strength, "QB")
    assert hard < 1.0


def test_sos_factor_is_clamped_and_weighted_by_position():
    strength = {t: 15.0 for t in ["A", "B", "C", "D"]}
    strength["A"] = 20.0
    # All-easy slate should clamp at the max factor regardless of position.
    assert p.sos_factor(["A", "A", "A"], strength, "QB") <= 1 + p._SOS_MAX_FACTOR
    # Kickers get no adjustment.
    assert p.sos_factor(["A", "A", "A"], strength, "K") == 1.0
    # DEF keys off a different (empty here) map → neutral.
    assert p.sos_factor(["A", "A", "A"], {}, "DEF") == 1.0
    # Missing opponents → neutral.
    assert p.sos_factor([], strength, "QB") == 1.0


def test_sos_factor_scale_differs_by_position():
    # The same favorable slate should move DEF/QB more than RB (lower weight).
    strength = {"A": 12.0, "B": 12.0, "C": 12.0, "D": 8.0}
    off_map = {"A": 12.0, "B": 12.0, "C": 12.0, "D": 8.0}
    qb = p.sos_factor(["A", "B", "C"], strength, "QB")
    rb = p.sos_factor(["A", "B", "C"], strength, "RB")
    assert qb > rb
    # DEF uses the off map; give it the same ratings to compare weights.
    df = p.sos_factor(["A", "B", "C"], off_map, "DEF")
    assert df > rb


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


def test_rookie_projection_all_skill_positions():
    rules = {"pass_yd": 0.04, "pass_td": 4, "int": -2, "rush_yd": 0.1, "rush_td": 6,
             "rec": 1, "rec_yd": 0.1, "rec_td": 6, "fg": 3, "pat": 1}
    for pos in ("QB", "RB", "WR", "TE", "K"):
        out = p.rookie_projection(pos, age=22)
        assert out["games"] == p.DEFAULT_GAMES
        # A baseline projection must produce a positive point total.
        pts = p.fantasy_projection(out["statline"], rules)
        assert pts > 0
        # Statline must have at least one non-zero raw stat.
        assert any(v > 0 for v in out["statline"].values())


def test_rookie_projection_unknown_position_empty():
    out = p.rookie_projection("DEF", age=None)
    assert out["statline"] == {}
    assert out["games"] == p.DEFAULT_GAMES


def test_rookie_projection_respects_age_curve():
    # QB at age 20 (pre-peak) should get more volume than at age 30 (decline).
    rules = {"pass_yd": 0.04, "pass_td": 4, "int": -2}
    young = p.fantasy_projection(p.rookie_projection("QB", age=20)["statline"], rules)
    old = p.fantasy_projection(p.rookie_projection("QB", age=33)["statline"], rules)
    assert young > old


def test_rookie_projection_volume_scale():
    # A backup (low volume_scale) should project for far fewer points than a
    # starter (full volume_scale).
    rules = {"pass_yd": 0.04, "pass_td": 4, "int": -2, "rush_yd": 0.1, "rush_td": 6}
    starter = p.fantasy_projection(p.rookie_projection("RB", age=22, volume_scale=1.0)["statline"], rules)
    backup = p.fantasy_projection(p.rookie_projection("RB", age=22, volume_scale=0.1)["statline"], rules)
    assert backup < starter * 0.2
    # Volume scales but efficiency stays — carries should shrink, not disappear.
    sl = p.rookie_projection("RB", age=22, volume_scale=0.5)["statline"]
    assert sl["carries"] > 0


def test_draft_capital_weight():
    assert p.draft_capital_weight(1) > p.draft_capital_weight(2) > p.draft_capital_weight(5)
    assert p.draft_capital_weight(None) == p.draft_capital_weight(0)  # unknown ~ UDFA
    assert p.draft_capital_weight(7) > 0


def test_role_opportunity():
    # No incumbent => fully open.
    assert p.role_opportunity(None, "QB") == 1.0
    assert p.role_opportunity(0.0, "QB") == 1.0
    # Elite incumbent (above threshold) => closed.
    assert p.role_opportunity(25.0, "QB") == 0.0
    # Weaker incumbent => more open.
    assert p.role_opportunity(5.0, "QB") > p.role_opportunity(15.0, "QB")


def test_rookie_volume_scale_combines_both():
    # Locked role + late-round pick => near zero.
    low = p.rookie_volume_scale(0.0, 5)
    assert low == 0.0
    # Open role + early pick => high.
    high = p.rookie_volume_scale(1.0, 1)
    assert high == pytest.approx(0.95)
    # A 1st-rounder in a locked role gets little; a 5th-rounder in an open role
    # also gets little — both signals must align.
    assert p.rookie_volume_scale(0.1, 1) < 0.2
    assert p.rookie_volume_scale(1.0, 5) < 0.3


def test_player_fpg_recency_weighted():
    rules = {"rush_yd": 0.1, "rush_td": 6, "rec": 1}
    # Two seasons; both identical so FPG is deterministic.
    rows = []
    for season in (2023, 2024):
        for w in range(1, 5):
            rows.append(_mk_row(season, w, rushing_yards=100, rushing_tds=1))
    fpg = p.player_fpg(rows, rules)
    assert fpg > 0
    # No data => 0.
    assert p.player_fpg([], rules) == 0.0


def test_games_expected_age_penalty():
    # An aging RB with a full recent history should project for fewer games than
    # a young RB with the same history.
    seasons = [{"season": 2023, "games": 17}, {"season": 2024, "games": 16}]
    young = p.games_expected(seasons, age=26, position="RB")
    old = p.games_expected(seasons, age=34, position="RB")
    assert old <= young
    # Injury volatility: an erratic games history pulls expected games down.
    erratic = [{"season": 2023, "games": 17}, {"season": 2024, "games": 5}]
    steady = [{"season": 2023, "games": 16}, {"season": 2024, "games": 17}]
    assert p.games_expected(erratic, age=26, position="RB") <= p.games_expected(steady, age=26, position="RB")


def test_projection_confidence_blends_signals():
    # More seasons / more games => higher confidence.
    thin = [{"season": 2024, "games": 8}]
    rich = [
        {"season": 2022, "games": 16},
        {"season": 2023, "games": 17},
        {"season": 2024, "games": 16},
    ]
    assert p.projection_confidence(rich, [10.0, 12.0, 11.0], current_season=2025) > p.projection_confidence(thin, [10.0], current_season=2025)
    # Volatility lowers confidence.
    steady = p.projection_confidence(rich, [15.0, 16.0, 15.5], current_season=2025)
    wild = p.projection_confidence(rich, [5.0, 25.0, 6.0], current_season=2025)
    assert steady > wild


def test_league_baselines_derives_from_data():
    # Two teams' worth of RBs with consistent usage => baselines near observed.
    rows_by_player = {}
    for i, (carries, targets) in enumerate([(300, 60), (250, 50), (280, 55)]):
        rows_by_player[f"rb{i}"] = []
        for season in (2023, 2024):
            for w in range(1, 15):
                rows_by_player[f"rb{i}"].append(_mk_row(season, w, carries=round(carries / 14), targets=round(targets / 14), rushing_yards=4 * round(carries / 14)))
    position_of = {f"rb{i}": "RB" for i in range(3)}
    vol, eff = p.league_baselines(rows_by_player, position_of)
    assert "RB" in vol
    # ~19 carries/game observed; baseline should be within a few carries of it.
    assert 15 < vol["RB"]["carries"] < 23
    # Efficiency baseline is a top-quartile value of observed YPC (~4.0).
    assert 3.5 < eff["RB"]["yards_per_carry"] < 5.0


def test_league_baselines_skips_positions_without_data():
    vol, eff = p.league_baselines({}, {})
    assert "QB" not in vol
    assert "TE" not in eff


def test_season_fpg_history():
    rules = {"rush_yd": 0.1, "rush_td": 6}
    rows = [
        _mk_row(2023, 1, rushing_yards=100, rushing_tds=1),
        _mk_row(2023, 2, rushing_yards=100, rushing_tds=1),
        _mk_row(2024, 1, rushing_yards=50, rushing_tds=0),
        _mk_row(2024, 2, rushing_yards=50, rushing_tds=0),
    ]
    hist = p.season_fpg_history(rows, rules)
    assert [(s, fpg) for s, fpg in hist] == [(2023, 16.0), (2024, 5.0)]
    assert p.season_fpg_history([], rules) == []


def test_rookie_range():
    low, high = p.rookie_range(100.0, 1.0)
    assert low < 100 < high
    # A more certain role (higher volume_scale) gives a narrower band.
    _, high_conf = p.rookie_range(100.0, 1.0)
    _, low_conf = p.rookie_range(100.0, 0.1)
    assert high_conf < low_conf


def test_team_share_factor():
    budget = {"carries": 25.0, "targets": 8.0}
    # Empty usage => nothing claimed.
    assert p.team_share_factor({}, budget) == 0.0
    # One workhorse RB claiming most carries => high share.
    assert p.team_share_factor({"carries": 24.0}, budget) > 0.9
    # Uses the most-claimed metric (conservative).
    assert p.team_share_factor({"carries": 25.0, "targets": 2.0}, budget) == 1.0

