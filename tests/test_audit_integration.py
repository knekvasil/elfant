"""End-to-end audit integration test on an in-memory SQLite database.

Exercises the full pipeline: league chain resolution, point-in-time projection
building, actuals computation, and metric aggregation — with real SQLAlchemy
sessions and the production models.
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import sessionmaker

from elfant.db.base import Base
from elfant.db.models import League, Player, PlayerWeeklyStat
from elfant import audit


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


def _league(league_id, season, previous_league_id):
    return League(
        league_id=league_id,
        name=f"lg {season}",
        season=str(season),
        total_rosters=12,
        previous_league_id=previous_league_id,
        scoring_settings={
            "pass_yd": 0.04, "pass_td": 4, "pass_int": -1,
            "rush_yd": 0.1, "rush_td": 6,
            "rec": 1, "rec_yd": 0.1, "rec_td": 6,
        },
        roster_positions=["QB", "RB", "RB", "WR", "WR", "TE", "K", "DEF"],
    )


def _stat(player_id, season, week, team, opponent, **kw):
    defaults = {
        "season_type": "REG", "team": team, "opponent": opponent,
    }
    defaults.update(kw)
    return PlayerWeeklyStat(player_id=player_id, season=season, week=week, **defaults)


@pytest.fixture()
def session():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, expire_on_commit=False)
    s = Session()

    s.add_all([
        _league("lg2026", 2026, "lg2025"),
        _league("lg2025", 2025, "lg2024"),
        _league("lg2024", 2024, None),
    ])

    # RB with prior history (vet for both 2024 and 2025 boards).
    s.add(Player(
        player_id="p1", first_name="P1", last_name="RB", position="RB",
        team="DAL", age=28, rookie_year=2021, years_exp=5, draft_round=None,
    ))
    # QB drafted in 2024 (rookie on the 2024 board, vet on the 2025 board).
    s.add(Player(
        player_id="p2", first_name="P2", last_name="QB", position="QB",
        team="KC", age=22, rookie_year=2024, years_exp=0, draft_round=1,
    ))

    # p1: 2023 (prior for 2024 board), 2024 (prior for 2025 + actual for 2024),
    #      2025 (actual for 2025).
    weekly = []
    for season, weeks in ((2023, 13), (2024, 14), (2025, 14)):
        for w in range(1, weeks + 1):
            weekly.append(_stat(
                "p1", season, w, "DAL", "NYG",
                carries=15, rushing_yards=60, rushing_tds=1,
                targets=3, receptions=2, receiving_yards=15,
            ))

    # p2: 2024 (prior for 2025 + actual for 2024), 2025 (actual for 2025).
    for season, weeks in ((2024, 12), (2025, 15)):
        for w in range(1, weeks + 1):
            weekly.append(_stat(
                "p2", season, w, "KC", "LAC",
                attempts=30, completions=20, passing_yards=250,
                passing_tds=2, passing_interceptions=1,
            ))

    # A team defense (keyed by abbreviation) for DEF projection variants.
    s.add(Player(
        player_id="DAL", first_name="Dallas", last_name="D/ST",
        position="DEF", team="DAL", status="Active",
    ))
    for season, weeks in ((2023, 17), (2024, 17)):
        for w in range(1, weeks + 1):
            weekly.append(_stat(
                "DAL", season, w, "DAL", "PHI",
                def_sacks=2, def_interceptions=1, pts_allowed=17, yds_allowed=330,
            ))

    # A much better defense, so the league-average DEF baseline differs from DAL.
    s.add(Player(
        player_id="KC", first_name="Kansas", last_name="D/ST",
        position="DEF", team="KC", status="Active",
    ))
    for season, weeks in ((2023, 17), (2024, 17)):
        for w in range(1, weeks + 1):
            weekly.append(_stat(
                "KC", season, w, "KC", "DEN",
                def_sacks=4, def_interceptions=2, pts_allowed=10, yds_allowed=280,
            ))

    # SQLite doesn't autoincrement BigInteger PKs — assign ids explicitly.
    for i, row in enumerate(weekly, start=1):
        row.id = i
    s.add_all(weekly)
    s.commit()
    yield s
    s.close()


def test_audit_league_end_to_end(session, monkeypatch):
    # Avoid network: fix the target-season schedule to an empty slate.
    monkeypatch.setattr(audit, "_target_schedule_opponents", lambda season: {})

    results = audit.audit_league(session, "lg2026", [2025, 2024])

    assert [r["season"] for r in results] == [2025, 2024]
    assert [r["league_id"] for r in results] == ["lg2025", "lg2024"]
    assert results[0]["as_of_season"] == 2025

    for res in results:
        assert res["players"], "expected some players on the board"
        # Every row is a projection for the target season, not a future one.
        for p in res["players"]:
            assert p["actual_points"] >= 0
            assert p["error"] == pytest.approx(p["actual_points"] - p["projected_points"])
        assert res["metrics"]["overall"]["n"] == len(res["players"])
        assert res["metrics"]["range_calibration"]["ranged"] == len(res["players"])

    by_id_2024 = {p["player_id"]: p for p in results[1]["players"]}
    by_id_2025 = {p["player_id"]: p for p in results[0]["players"]}

    # p1 is a vet on both boards; p2 is a rookie in 2024, a vet in 2025.
    assert by_id_2024["p1"]["kind"] == "vet"
    assert by_id_2024["p2"]["kind"] == "rookie"
    assert by_id_2025["p2"]["kind"] in ("vet", "unknown")

    # Known actuals: p1 = 14 games × 15.5 FP = 217.0; p2 = 12 games × 17 FP = 204.0.
    assert by_id_2024["p1"]["actual_points"] == pytest.approx(217.0)
    assert by_id_2024["p1"]["actual_games"] == 14
    assert by_id_2024["p2"]["actual_points"] == pytest.approx(204.0)
    assert by_id_2025["p1"]["actual_points"] == pytest.approx(217.0)
    assert by_id_2025["p2"]["actual_points"] == pytest.approx(15 * 17.0)


def test_point_in_time_applied_in_board(session, monkeypatch):
    # p1 changed teams: Player.team is the current team (NYJ), but the prior-
    # season rows put him on DAL. Age 28 as-of 2025 → 27 at the 2024 draft.
    monkeypatch.setattr(audit, "_target_schedule_opponents", lambda season: {})
    session.query(Player).filter_by(player_id="p1").one().team = "NYJ"
    session.commit()

    league = audit.league_for_season(session, "lg2026", 2024)
    pit = audit.build_projections(session, league, target_season=2024, point_in_time=True, as_of_season=2025)
    nopit = audit.build_projections(session, league, target_season=2024, point_in_time=False, as_of_season=2025)

    p_pit = next(p for p in pit["players"] if p["player_id"] == "p1")
    p_nopit = next(p for p in nopit["players"] if p["player_id"] == "p1")
    assert p_pit["team"] == "DAL"
    assert p_nopit["team"] == "NYJ"
    # PIT age 27 is inside the RB peak (factor 1.0); naive age 28 is past it
    # (factor < 1), so the point-in-time projection differs from the naive one.
    assert p_pit["projected_points"] != p_nopit["projected_points"]


def test_league_for_season_walks_chain(session):
    assert audit.league_for_season(session, "lg2026", 2025).league_id == "lg2025"
    assert audit.league_for_season(session, "lg2026", 2024).league_id == "lg2024"
    assert audit.league_for_season(session, "lg2026", 2026).league_id == "lg2026"
    assert audit.league_for_season(session, "lg2026", 1999) is None


def test_proj_options_def_method_changes_def(session, monkeypatch):
    monkeypatch.setattr(audit, "_target_schedule_opponents", lambda season: {})
    league = audit.league_for_season(session, "lg2026", 2025)
    # "avg" is the default now; force "recency" to compare.
    base = audit.build_projections(session, league, target_season=2025, point_in_time=True, as_of_season=2025)
    alt = audit.build_projections(session, league, target_season=2025, point_in_time=True, as_of_season=2025,
                                  proj_options={"def_method": "recency"})
    def_base = next(p for p in base["players"] if p["position"] == "DEF")
    def_alt = next(p for p in alt["players"] if p["position"] == "DEF")
    # Default (avg) pulls the defense toward the league-average baseline → differs.
    assert def_base["projected_points"] != def_alt["projected_points"]
    assert def_base["sos_factor"] == def_alt["sos_factor"]


def test_proj_options_confidence_scaling_boosts_vets(session, monkeypatch):
    monkeypatch.setattr(audit, "_target_schedule_opponents", lambda season: {})
    league = audit.league_for_season(session, "lg2026", 2025)
    base = audit.build_projections(session, league, target_season=2025, point_in_time=True, as_of_season=2025)
    scaled = audit.build_projections(session, league, target_season=2025, point_in_time=True, as_of_season=2025,
                                     proj_options={"confidence_scaling": 0.5})
    p_base = next(p for p in base["players"] if p["player_id"] == "p1")
    p_scaled = next(p for p in scaled["players"] if p["player_id"] == "p1")
    assert p_base["confidence"] > 0.5  # p1 has solid history
    assert p_scaled["projected_points"] > p_base["projected_points"]


def test_audit_defaults_to_completed_seasons(session, monkeypatch):
    # No --seasons: the newest chain season (2026) is excluded, older ones kept.
    monkeypatch.setattr(audit, "_target_schedule_opponents", lambda season: {})
    results = audit.audit_league(session, "lg2026", None)
    assert [r["season"] for r in results] == [2025, 2024]