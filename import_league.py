"""Import all data for Elite Fantasy league across all seasons."""
import sys
from elfant.api.sleeper import SleeperAPI
from elfant.sync import sync as s
from elfant.db.base import get_session, Base, engine
from elfant.db.models import League

api = SleeperAPI()


def get_league_chain(start_id):
    chain = []
    league_id = start_id
    while league_id:
        league = api.get_league(league_id)
        chain.append((league_id, league.get("season")))
        league_id = league.get("previous_league_id")
    return chain


def get_weeks_for_league(league_id):
    for w in range(1, 23):
        data = api.get_league_matchups(league_id, w)
        if not data:
            return w - 1
    return 22


def import_league(league_id, season_label):
    print(f"\n=== {season_label} ({league_id}) ===")

    s.sync_league(league_id)
    s.sync_league_users(league_id)
    s.sync_rosters(league_id)

    weeks = get_weeks_for_league(league_id)
    print(f"  Weeks found: {weeks}")

    for w in range(1, weeks + 1):
        s.sync_matchups(league_id, w)
        s.sync_transactions(league_id, w)
        if w % 5 == 0:
            print(f"  Synced weeks 1-{w}...")

    s.sync_traded_picks(league_id)
    s.sync_drafts(league_id)

    with get_session() as session:
        league = session.get(League, league_id)
        if league and league.draft_id:
            try:
                s.sync_draft_picks(league.draft_id)
            except Exception as e:
                print(f"  Warning: draft pick sync failed: {e}")


def main():
    Base.metadata.create_all(engine)

    start_id = "1250519825399169024"
    chain = get_league_chain(start_id)
    print(f"Found {len(chain)} seasons:")
    for lid, season in chain:
        print(f"  {lid}: {season}")

    for lid, season in chain:
        import_league(lid, season)

    print("\nDone!")


if __name__ == "__main__":
    main()
