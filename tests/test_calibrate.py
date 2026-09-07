import pytest

from elfant import calibrate as c


def _row(position="RB", kind="vet", projected=100.0, games=15.0, confidence=0.5,
         age=25, draft_round=2, seasons_used=2, actual=110.0, **stat):
    row = {
        "position": position, "kind": kind, "projected_points": projected,
        "base_points": 0.0, "games": games, "confidence": confidence,
        "age": age, "draft_round": draft_round, "seasons_used": seasons_used,
        "actual_points": actual, "actual_games": games,
        "attempts": 0.0, "carries": 0.0, "targets": 0.0, "receptions": 0.0,
        "passing_yards": 0.0, "rushing_yards": 0.0, "receiving_yards": 0.0,
        "passing_tds": 0.0, "rushing_tds": 0.0, "receiving_tds": 0.0,
    }
    row.update(stat)
    return row


def test_solve_simple_system():
    # 2x + y = 5 ; x - y = 1  => x=2, y=1
    x = c._solve([[2.0, 1.0], [1.0, -1.0]], [5.0, 1.0])
    assert x[0] == pytest.approx(2.0)
    assert x[1] == pytest.approx(1.0)


def test_fit_ridge_recovers_linear_relationship():
    # actual = 0.8 * projected (true relationship), no noise.
    rows = [_row(projected=p, actual=0.8 * p) for p in (50, 100, 150, 200, 250)]
    weights, names = c.fit_ridge(rows)
    w = dict(zip(names, weights))
    assert w["projected_points"] == pytest.approx(0.8, abs=0.05)
    # Position dummies for RB only used; others ~0.
    assert w["pos:QB"] == pytest.approx(0.0, abs=0.05)


def test_evaluate_model_beats_baseline_when_true_relationship_differs():
    # Training: actual = 0.5 * projected (projection overstates by 2x).
    train = [_row(projected=p, actual=0.5 * p) for p in (50, 100, 150, 200, 250)]
    test = [_row(projected=p, actual=0.5 * p) for p in (60, 120, 180)]
    res = c.evaluate(train, test)
    assert res["model"]["mae"] < res["baseline"]["mae"]
    # Model should be near-zero error; baseline off by ~50%.
    assert res["model"]["mae"] < 1.0


def test_evaluate_baseline_best_when_projection_is_right():
    train = [_row(projected=p, actual=p) for p in (50, 100, 150, 200, 250)]
    test = [_row(projected=p, actual=p) for p in (60, 120, 180)]
    res = c.evaluate(train, test)
    assert res["baseline"]["mae"] <= res["model"]["mae"] + 1e-6


def test_cross_validate_both_directions():
    s2024 = [_row(projected=100, actual=50) for _ in range(3)]
    s2025 = [_row(projected=100, actual=150) for _ in range(3)]
    res = c.cross_validate({2024: s2024, 2025: s2025})
    assert set(res) == {"2024->2025", "2025->2024"}
    assert {"baseline", "model", "weights"} <= set(res["2024->2025"])


def test_leave_one_out_pooled_across_folds():
    # Consistent relationship across 3 seasons: model should win out-of-sample.
    seasons = {}
    for s, base in ((2021, 50.0), (2022, 60.0), (2023, 70.0)):
        seasons[s] = [_row(projected=p, actual=0.5 * p) for p in (base, base + 50, base + 100)]
    res = c.leave_one_out(seasons)
    assert set(res["folds"]) == {"2021", "2022", "2023"}
    for fold in res["folds"].values():
        assert fold["model"]["mae"] < 1.0
        assert fold["model"]["mae"] < fold["baseline"]["mae"]
    p = res["pooled"]
    assert p["n"] == 9
    assert p["model"]["mae"] < p["baseline"]["mae"]
    assert p["baseline"]["mae"] > 20  # raw projection is 2x off


def test_leave_one_out_top_n_trims_each_season():
    seasons = {2021: [_row(projected=p, actual=p) for p in (50, 100, 200, 300)],
               2022: [_row(projected=p, actual=p) for p in (60, 110, 210, 310)]}
    res = c.leave_one_out(seasons, top_n=2)
    # Only the top-2 projected rows from each season are scored.
    assert res["pooled"]["n"] == 4


def test_top_n_subset():
    rows = [_row(projected=p) for p in (50, 200, 100, 300)]
    top = c._top_n(rows, 2)
    assert [r["projected_points"] for r in top] == [300.0, 200.0]


def test_load_rows_coerces_types(tmp_path):
    path = tmp_path / "audit.csv"
    path.write_text(
        "player_id,name,position,team,kind,is_rookie,draft_round,age,years_exp,"
        "seasons_used,projected_points,base_points,sos_factor,games,confidence,"
        "range_low,range_high,actual_points,actual_games,error,"
        "attempts,carries,targets,receptions,passing_yards,rushing_yards,"
        "receiving_yards,passing_tds,rushing_tds,receiving_tds\n"
        "p1,A,RB,DAL,vet,False,2,25,3,2,100.5,100.5,1.0,15,0.5,80,120,110.2,14,9.7,"
        "0,200,40,30,0,900,300,0,8,2\n"
    )
    rows = c.load_rows(str(path))
    assert len(rows) == 1
    r = rows[0]
    assert r["position"] == "RB"
    assert r["projected_points"] == pytest.approx(100.5)
    assert r["actual_points"] == pytest.approx(110.2)
    assert r["carries"] == pytest.approx(200.0)
    assert r["seasons_used"] == pytest.approx(2.0)


def test_load_rows_from_players_flattens_nested():
    players = [{
        "player_id": "p1", "position": "RB", "kind": "vet", "age": 25,
        "draft_round": 2, "projected_points": 100.5, "base_points": 99.0,
        "games": 15, "confidence": 0.6, "actual_points": 110.2, "actual_games": 14,
        "statline": {"carries": 200, "rushing_yards": 900, "receiving_tds": 2},
        "usage": {"seasons_used": 2},
    }]
    rows = c.load_rows_from_players(players)
    assert len(rows) == 1
    r = rows[0]
    assert r["carries"] == pytest.approx(200.0)
    assert r["rushing_yards"] == pytest.approx(900.0)
    assert r["receiving_tds"] == pytest.approx(2.0)
    assert r["seasons_used"] == pytest.approx(2.0)
    assert r["targets"] == pytest.approx(0.0)
    assert r["position"] == "RB"