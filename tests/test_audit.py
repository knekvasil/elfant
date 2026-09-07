import pytest

from elfant import audit as a


def _mk_row(player_id, season, week, team=None, opponent=None, **kw):
    class R:
        pass
    r = R()
    r.player_id = player_id
    r.season = season
    r.week = week
    r.season_type = "REG"
    r.team = team
    r.opponent = opponent
    for k, v in kw.items():
        setattr(r, k, v)
    return r


def test_pearson():
    xs = [1.0, 2.0, 3.0, 4.0]
    ys = [2.0, 4.0, 6.0, 8.0]
    assert a._pearson(xs, ys) == pytest.approx(1.0)
    assert a._pearson(xs, [-x for x in ys]) == pytest.approx(-1.0)
    assert a._pearson([1.0], [1.0]) is None  # too few points
    assert a._pearson([1.0, 2.0], [1.0, 1.0]) is None  # zero variance


def test_spearman():
    # Monotonic (non-linear) relationship → rank correlation 1.
    xs = [1.0, 2.0, 3.0, 4.0]
    ys = [100.0, 7.0, 5.0, 1.0]
    assert a._spearman(xs, ys) == pytest.approx(-1.0)
    # Ties get the average rank.
    ranks = a._rank([10.0, 20.0, 20.0, 30.0])
    assert ranks[0] == 1.0
    assert ranks[1] == 2.5
    assert ranks[2] == 2.5
    assert ranks[3] == 4.0


def test_metrics():
    # actual = projected / 2 → perfectly correlated, errors = -proj/2.
    pairs = [(100.0, 50.0), (200.0, 100.0), (300.0, 150.0)]
    m = a._metrics(pairs)
    assert m["n"] == 3
    assert m["bias"] == pytest.approx(-100.0, abs=0.01)
    assert m["mae"] == pytest.approx(100.0, abs=0.01)
    assert m["rmse"] == pytest.approx(108.01, abs=0.01)  # sqrt((2500+10000+22500)/3)
    assert m["pearson"] == pytest.approx(1.0)
    assert m["spearman"] == pytest.approx(1.0)
    assert a._metrics([]) == {}


def test_actual_season_points_regular_only():
    rules = {"rush_yd": 0.1, "rush_td": 6}
    rows = [
        _mk_row("p1", 2024, 1, rushing_yards=100, rushing_tds=1),
        _mk_row("p1", 2024, 2, rushing_yards=50, rushing_tds=0),
        _mk_row("p1", 2024, 3, rushing_yards=20, rushing_tds=0, season_type="POST"),
        _mk_row("p1", 2025, 1, rushing_yards=200, rushing_tds=2),
    ]
    pts, games = a.actual_season_points(rows, rules, 2024)
    assert games == 2
    assert pts == pytest.approx(21.0)  # week1 (10+6) + week2 (5)
    pts25, games25 = a.actual_season_points(rows, rules, 2025)
    assert games25 == 1
    assert pts25 == pytest.approx(32.0)


def test_apply_point_in_time_team_and_age():
    player_map = {
        "p1": {"team": "CURRENT_TEAM", "age": 30, "position": "RB"},
        "def": {"team": "CURRENT_TEAM", "age": None, "position": "DEF"},
    }
    rows = [
        _mk_row("p1", 2022, 1, team="CHI"),
        _mk_row("p1", 2023, 1, team="CHI"),
        _mk_row("p1", 2023, 2, team="DET"),  # moved mid-way; most recent season wins
        _mk_row("DAL", 2023, 1, team="DAL"),  # team-defense row — must be ignored
    ]
    out = a._apply_point_in_time(player_map, rows, as_of_season=2025, target_season=2024)
    assert out["p1"]["team"] == "DET"
    assert out["p1"]["age"] == 29  # back out one season
    # DEF rows untouched (no age adjustment when age is None).
    assert out["def"]["team"] == "CURRENT_TEAM"


def test_apply_point_in_time_no_elapsed_keeps_age():
    player_map = {"p1": {"team": "CURRENT_TEAM", "age": 27}}
    out = a._apply_point_in_time(player_map, [], as_of_season=2024, target_season=2024)
    assert out["p1"]["age"] == 27
    # as_of before target → no age adjustment either.
    out2 = a._apply_point_in_time({"p1": {"team": "X", "age": 27}}, [], as_of_season=2024, target_season=2025)
    assert out2["p1"]["age"] == 27


def test_apply_point_in_time_does_not_mutate_input():
    pm = {"p1": {"team": "OLD", "age": 30}}
    a._apply_point_in_time(pm, [_mk_row("p1", 2023, 1, team="NEW")], as_of_season=2025, target_season=2024)
    assert pm["p1"]["team"] == "OLD"
    assert pm["p1"]["age"] == 30


def test_season_metrics_slices():
    players = [
        {"position": "RB", "projected_points": 200, "actual_points": 210,
         "confidence": 0.8, "kind": "vet", "games": 15, "actual_games": 16,
         "range_low": 180, "range_high": 220},
        {"position": "QB", "projected_points": 300, "actual_points": 250,
         "confidence": 0.4, "kind": "vet", "games": 16, "actual_games": 10,
         "range_low": 240, "range_high": 360},
        {"position": "RB", "projected_points": 100, "actual_points": 0,
         "confidence": 0.2, "kind": "rookie", "games": 15, "actual_games": 0,
         "range_low": 60, "range_high": 140},
    ]
    m = a._season_metrics(players)
    assert m["overall"]["n"] == 3
    assert set(m["by_position"]) == {"RB", "QB"}
    assert m["by_position"]["RB"]["n"] == 2
    # Confidence buckets: one each in very_high / mid / low.
    assert m["by_confidence"]["very_high"]["n"] == 1
    assert m["by_confidence"]["mid"]["n"] == 1
    assert m["by_confidence"]["low"]["n"] == 1
    # Range calibration: actuals 210, 250, 0 vs ranges [180,220],[240,360],[60,140]
    assert m["range_calibration"] == {"in_range": 2, "ranged": 3, "hit_rate": pytest.approx(2 / 3, abs=0.001)}
    assert m["by_kind"]["vet"]["n"] == 2
    assert m["games"]["n"] == 3


def test_rank_hit_rate():
    players = [
        {"player_id": "a", "position": "QB", "projected_points": 300, "actual_points": 250},
        {"player_id": "b", "position": "QB", "projected_points": 200, "actual_points": 300},
        {"player_id": "c", "position": "QB", "projected_points": 100, "actual_points": 150},
        {"player_id": "d", "position": "QB", "projected_points": 50, "actual_points": 40},
        {"player_id": "x", "position": "RB", "projected_points": 100, "actual_points": 100},
    ]
    rh = a.rank_hit_rate(players, 4)
    assert "RB" not in rh  # too few players
    qb = rh["QB"]
    assert qb["n"] == 4
    # projected top-4 {a,b,c,d}; actual top-4 {b,c,a,d} → all four overlap.
    assert qb["overlap"] == 4
    assert qb["hit_rate"] == 1.0


def test_rank_hit_rate_respects_top_n():
    players = [
        {"player_id": f"p{i}", "position": "WR", "projected_points": 100 - i, "actual_points": 90 - i}
        for i in range(8)
    ]
    # Projected order p0..p7; actual order is the same → overlap = top_n.
    assert a.rank_hit_rate(players, 6)["WR"]["overlap"] == 6


def test_season_metrics_includes_rank_hit_rate():
    players = [
        {"player_id": "a", "position": "QB", "projected_points": 100, "actual_points": 90,
         "confidence": 0.5, "kind": "vet", "games": 15, "actual_games": 14,
         "range_low": 50, "range_high": 150},
        {"player_id": "b", "position": "QB", "projected_points": 90, "actual_points": 100,
         "confidence": 0.5, "kind": "vet", "games": 15, "actual_games": 15,
         "range_low": 40, "range_high": 140},
        {"player_id": "c", "position": "QB", "projected_points": 80, "actual_points": 70,
         "confidence": 0.5, "kind": "vet", "games": 15, "actual_games": 13,
         "range_low": 30, "range_high": 130},
        {"player_id": "d", "position": "QB", "projected_points": 70, "actual_points": 60,
         "confidence": 0.5, "kind": "vet", "games": 15, "actual_games": 12,
         "range_low": 20, "range_high": 120},
    ]
    m = a._season_metrics(players)
    assert m["rank_hit_rate"]["top12"]["QB"]["overlap"] == 4
    assert m["rank_hit_rate"]["top24"]["QB"]["overlap"] == 4


def test_pooled_metrics_averages_rank_hit_rate():
    def season(overlap_top12, overlap_top24, pos="QB"):
        return {
            "players": [],
            "metrics": {
                "rank_hit_rate": {
                    "top12": {pos: {"n": 12, "overlap": overlap_top12, "hit_rate": overlap_top12 / 12}},
                    "top24": {pos: {"n": 24, "overlap": overlap_top24, "hit_rate": overlap_top24 / 24}},
                },
            },
        }
    results = [season(6, 12), season(8, 18)]
    m = a.pooled_metrics(results)
    # 6/12 (0.5) and 8/12 (0.667) → avg 0.583; top24 12/24 (0.5) and 18/24 (0.75) → avg 0.625.
    assert m["rank_hit_rate"]["top12"]["QB"]["avg"] == round((0.5 + 0.6667) / 2, 3)
    assert m["rank_hit_rate"]["top12"]["QB"]["seasons"] == 2
    assert m["rank_hit_rate"]["top24"]["QB"]["avg"] == round((0.5 + 0.75) / 2, 3)


def test_write_csv_roundtrip(tmp_path):
    players = [
        {"player_id": "a", "name": "A", "position": "RB", "team": "DAL",
         "kind": "vet", "is_rookie": False, "draft_round": 2,
         "projected_points": 200, "base_points": 195, "sos_factor": 1.0,
         "games": 15, "confidence": 0.7, "range_low": 170, "range_high": 230,
         "actual_points": 210, "actual_games": 16, "error": 10.0},
    ]
    path = a.write_csv(players, str(tmp_path / "audit.csv"))
    content = (tmp_path / "audit.csv").read_text()
    assert content.startswith("player_id,name,position,team,kind,is_rookie,draft_round,")
    assert "210" in content
    assert path.endswith("audit.csv")