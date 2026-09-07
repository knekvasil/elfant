import argparse
import sys

from elfant.db.base import get_session
from elfant.db.models import (
    League, Roster, LeagueUser, User, Player, Draft, DraftPick,
    Matchup, Transaction, TradedPick, NflState,
)
from elfant.sync.sync import (
    sync_user, sync_league, sync_league_all, sync_players,
    sync_matchups, sync_transactions, sync_nfl_state,
    sync_player_ids, sync_player_weekly_stats, sync_team_weekly_stats,
    sync_team_defense_opp_stats, sync_defense_pbp_stats,
    sync_player_snap_counts, sync_defense_time_of_possession,
)


def cmd_init(args):
    from alembic.config import Config
    from alembic import command
    command.upgrade(Config("alembic.ini"), "head")
    print("Migrations applied.")


def cmd_user(args):
    from elfant.api.sleeper import SleeperAPI
    api = SleeperAPI()
    data = api.get_user(args.user_id)
    sync_user(data)
    print(f"User: {data.get('display_name', '?')} (@{data.get('username', '?')}) [{data['user_id']}]")


def cmd_league(args):
    sync_league_all(args.league_id)
    with get_session() as session:
        league = session.get(League, args.league_id)
        if not league:
            print(f"League {args.league_id} not found.")
            return
        print(f"League: {league.name} ({league.season})")
        rosters = (
            session.query(Roster).filter_by(league_id=args.league_id).count()
        )
        users = (
            session.query(LeagueUser)
            .filter_by(league_id=args.league_id)
            .count()
        )
        print(f"  Rosters: {rosters}")
        print(f"  Users: {users}")


def cmd_leagues(args):
    from elfant.api.sleeper import SleeperAPI
    api = SleeperAPI()
    data = api.get_user(args.user_id)
    sync_user(data)
    leagues = api.get_user_leagues(data["user_id"], args.sport, args.season)
    for lg in leagues:
        print(f"{lg['league_id']}  {lg['name']:40s}  {lg['season']}  {lg.get('status', '?'):12s}")


def cmd_players(args):
    sync_players()
    with get_session() as session:
        total = session.query(Player).count()
        print(f"Synced {total} players.")


def cmd_matchups(args):
    sync_matchups(args.league_id, args.week)
    with get_session() as session:
        matchups = (
            session.query(Matchup)
            .filter_by(league_id=args.league_id, week=args.week)
            .all()
        )
        for m in matchups:
            print(f"  Matchup {m.matchup_id} | Roster {m.roster_id}: {m.points} pts")


def cmd_transactions(args):
    sync_transactions(args.league_id, args.week)
    with get_session() as session:
        txns = (
            session.query(Transaction)
            .filter_by(league_id=args.league_id, leg=args.week)
            .all()
        )
        for t in txns:
            print(f"  {t.transaction_id} | type={t.type} status={t.status}")


def cmd_state(args):
    sync_nfl_state()
    with get_session() as session:
        state = session.query(NflState).order_by(NflState.id.desc()).first()
        if state:
            print(f"NFL State: {state.season} week {state.week} ({state.season_type})")


def cmd_player_ids(args):
    sync_player_ids()
    with get_session() as session:
        total = session.query(Player).count()
        mapped = session.query(Player).filter(Player.gsis_id.isnot(None)).count()
        print(f"Players: {total} total, {mapped} with gsis_id")


def cmd_sync_stats(args):
    seasons = [int(s) for s in args.seasons.split(",")] if args.seasons else None
    sync_player_weekly_stats(seasons)
    sync_team_weekly_stats(seasons)
    sync_team_defense_opp_stats(seasons)
    sync_defense_pbp_stats(seasons)
    sync_player_snap_counts(seasons)
    sync_defense_time_of_possession(seasons)


def cmd_info(args):
    with get_session() as session:
        print("Database stats:")
        for model, label in [
            (User, "Users"),
            (League, "Leagues"),
            (Roster, "Rosters"),
            (Player, "Players"),
            (Draft, "Drafts"),
            (DraftPick, "Draft picks"),
            (Matchup, "Matchups"),
            (Transaction, "Transactions"),
            (TradedPick, "Traded picks"),
        ]:
            count = session.query(model).count()
            print(f"  {label}: {count}")


def cmd_audit_projections(args):
    from elfant.audit import audit_league, write_csv, pooled_metrics
    import os

    seasons = [int(s) for s in args.seasons.split(",")] if args.seasons else None
    options = _parse_proj_options(args.proj_options)
    with get_session() as session:
        results = audit_league(session, args.league_id, seasons, proj_options=options)

    if not results:
        print(f"No auditable seasons for league {args.league_id} "
              f"(seasons requested: {seasons or 'all found in chain'}). "
              "Check the league chain and that stats are synced.")
        return

    if options:
        print(f"Projection options: {options}")

    out_dir = args.out_dir or "."
    for res in results:
        season = res["season"]
        path = write_csv(res["players"], os.path.join(out_dir, f"projections_audit_{season}.csv"))
        print(f"\n=== {season} (league {res['league_id']}) — as-of {res['as_of_season']} ===")
        print(f"  CSV: {path}")
        _print_audit_metrics(res["metrics"])

    if len(results) > 1:
        print(f"\n=== POOLED across {len(results)} audited seasons "
              f"({len([p for r in results for p in r['players']])} player-seasons) ===")
        _print_audit_metrics(pooled_metrics(results))


def _parse_proj_options(raw: str | None) -> dict:
    """Parse "key=value,key=value" into a proj_options dict (numeric coerced)."""
    if not raw:
        return {}
    out: dict = {}
    for part in raw.split(","):
        part = part.strip()
        if "=" not in part:
            continue
        k, _, v = part.partition("=")
        try:
            v = float(v)
        except ValueError:
            pass
        out[k.strip()] = v
    return out


def _print_audit_metrics(metrics: dict):
    overall = metrics.get("overall") or {}
    if overall:
        print("  Overall:")
        print(f"    n={overall.get('n')} bias={overall.get('bias')} "
              f"MAE={overall.get('mae')} RMSE={overall.get('rmse')} "
              f"Pearson={overall.get('pearson')} Spearman={overall.get('spearman')}")
    print("  By position:")
    for pos, m in (metrics.get("by_position") or {}).items():
        print(f"    {pos:3s} n={m.get('n')} bias={m.get('bias')} MAE={m.get('mae')} "
              f"RMSE={m.get('rmse')} pearson={m.get('pearson')}")
    print("  By confidence:")
    for name, m in (metrics.get("by_confidence") or {}).items():
        print(f"    {name:9s} n={m.get('n')} bias={m.get('bias')} MAE={m.get('mae')} "
              f"RMSE={m.get('rmse')}")
    rc = metrics.get("range_calibration") or {}
    if rc.get("ranged"):
        print(f"  Range calibration: {rc['in_range']}/{rc['ranged']} in range "
              f"({rc['hit_rate']})")
    gm = metrics.get("games") or {}
    if gm.get("n"):
        print(f"  Games: n={gm['n']} bias={gm['bias']} MAE={gm['mae']} RMSE={gm['rmse']}")
    rh = metrics.get("rank_hit_rate") or {}
    for level in ("top12", "top24"):
        table = rh.get(level) or {}
        if not table:
            continue
        parts = []
        for pos, v in table.items():
            if "avg" in v:  # pooled: averaged per-season hit-rate
                parts.append(f"{pos}: {v['avg']:.0%} (avg of {v['seasons']})")
            else:  # single season
                parts.append(f"{pos}: {v['overlap']}/{v['n']}")
        print(f"  Rank hit-rate ({level}): {', '.join(parts)}")


def cmd_calibrate(args):
    from elfant.audit import audit_league
    from elfant import calibrate

    seasons = [int(s) for s in args.seasons.split(",")] if args.seasons else None
    with get_session() as session:
        results = audit_league(session, args.league_id, seasons)

    if not results:
        print(f"No auditable seasons for league {args.league_id}.")
        return

    rows_by_season = {r["season"]: calibrate.load_rows_from_players(r["players"]) for r in results}
    rows_by_season = {s: rows for s, rows in rows_by_season.items() if rows}
    if len(rows_by_season) < 2:
        print("Calibration needs at least two auditable seasons; "
              f"got {list(rows_by_season)}.")
        return

    print("=== Feature fit: leave-one-season-out ===")
    print(f"  seasons={sorted(rows_by_season)}  alpha(ridge)={calibrate.RIDGE_ALPHA}")
    for label, subset in (("full board", None), ("top 200 projected", 200)):
        loso = calibrate.leave_one_out(rows_by_season, top_n=subset)
        print(f"\n  [{label}]")
        for test, res in loso["folds"].items():
            b, m = res["baseline"], res["model"]
            print(f"    holdout {test}: baseline MAE={b['mae']:6.2f} R2={b['r2']:.3f} | "
                  f"model MAE={m['mae']:6.2f} R2={m['r2']:.3f}")
        p = loso["pooled"]
        b, m = p["baseline"], p["model"]
        print(f"    POOLED n={p['n']}: baseline MAE={b['mae']:6.2f} RMSE={b['rmse']:6.2f} "
              f"R2={b['r2']:.3f} | model MAE={m['mae']:6.2f} RMSE={m['rmse']:6.2f} R2={m['r2']:.3f}")

    # Show the top learned weights from the first season's fit.
    first = next(iter(loso["folds"].values()))
    print("\n  Top learned weights (largest |coef|, first holdout's training set):")
    for name, w in sorted(first["weights"], key=lambda x: -abs(x[1]))[:12]:
        print(f"    {name:24s} {w:+.4f}")


def main():
    parser = argparse.ArgumentParser(
        prog="elfant",
        description="Sleeper fantasy football data tool",
    )
    sub = parser.add_subparsers(dest="command")

    p_init = sub.add_parser("init", help="Create database tables")
    p_init.set_defaults(func=cmd_init)

    p_user = sub.add_parser("user", help="Look up / sync a Sleeper user")
    p_user.add_argument("user_id", help="Sleeper user ID or username")
    p_user.set_defaults(func=cmd_user)

    p_leagues = sub.add_parser("leagues", help="List leagues for a user")
    p_leagues.add_argument("user_id", help="Sleeper user ID")
    p_leagues.add_argument("--sport", default="nfl")
    p_leagues.add_argument("--season", default=None)
    p_leagues.set_defaults(func=cmd_leagues)

    p_league = sub.add_parser("league", help="Sync a league by ID")
    p_league.add_argument("league_id", help="Sleeper league ID")
    p_league.set_defaults(func=cmd_league)

    p_players = sub.add_parser("players", help="Sync all NFL players")
    p_players.set_defaults(func=cmd_players)

    p_matchups = sub.add_parser("matchups", help="Sync matchups for a league/week")
    p_matchups.add_argument("league_id")
    p_matchups.add_argument("week", type=int)
    p_matchups.set_defaults(func=cmd_matchups)

    p_txns = sub.add_parser("transactions", help="Sync transactions for a league/week")
    p_txns.add_argument("league_id")
    p_txns.add_argument("week", type=int)
    p_txns.set_defaults(func=cmd_transactions)

    p_state = sub.add_parser("state", help="Sync NFL state")
    p_state.set_defaults(func=cmd_state)

    p_player_ids = sub.add_parser("player-ids", help="Map gsis_id to Player records")
    p_player_ids.set_defaults(func=cmd_player_ids)

    p_sync_stats = sub.add_parser("sync-stats", help="Sync player weekly stats from nflverse")
    p_sync_stats.add_argument("--seasons", help="Comma-separated list of seasons (e.g. 2023,2024)")
    p_sync_stats.set_defaults(func=cmd_sync_stats)

    p_info = sub.add_parser("info", help="Show database summary")
    p_info.set_defaults(func=cmd_info)

    p_audit = sub.add_parser(
        "audit-projections",
        help="Backtest draft projections against completed seasons",
    )
    p_audit.add_argument("league_id", help="Sleeper league ID (current season's league)")
    p_audit.add_argument(
        "--seasons", default=None,
        help="Comma-separated target seasons to audit (default: all seasons in the league chain)",
    )
    p_audit.add_argument(
        "--out-dir", default=None,
        help="Directory for per-season CSVs (default: current directory)",
    )
    p_audit.add_argument(
        "--proj-options", default=None,
        help="Comma-separated key=value projection overrides for prototyping "
             "(e.g. def_method=shrink,confidence_scaling=0.3)",
    )
    p_audit.set_defaults(func=cmd_audit_projections)

    p_cal = sub.add_parser(
        "calibrate-projections",
        help="Fit projection features to post-season grades (cross-season)",
    )
    p_cal.add_argument("league_id", help="Sleeper league ID (current season's league)")
    p_cal.add_argument(
        "--seasons", default=None,
        help="Comma-separated seasons to fit on (default: all completed in chain)",
    )
    p_cal.set_defaults(func=cmd_calibrate)

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        sys.exit(1)
    args.func(args)


if __name__ == "__main__":
    main()
