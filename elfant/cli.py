import argparse
import sys

from elfant.db.base import engine, Base, get_session
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
    Base.metadata.create_all(engine)
    print("Tables created.")


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

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        sys.exit(1)
    args.func(args)


if __name__ == "__main__":
    main()
