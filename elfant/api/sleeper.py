import time
import requests

BASE = "https://api.sleeper.app/v1"


class SleeperAPI:
    def __init__(self, rate_limit_per_min=1000):
        self.session = requests.Session()
        self.min_interval = 60.0 / rate_limit_per_min
        self._last_request = 0.0

    def _request(self, path):
        now = time.time()
        elapsed = now - self._last_request
        if elapsed < self.min_interval:
            time.sleep(self.min_interval - elapsed)
        url = f"{BASE}{path}"
        resp = self.session.get(url, timeout=30)
        self._last_request = time.time()
        resp.raise_for_status()
        return resp.json()

    def get_user(self, user_id_or_name):
        return self._request(f"/user/{user_id_or_name}")

    def get_user_leagues(self, user_id, sport="nfl", season=None):
        if season is None:
            state = self.get_nfl_state()
            season = state["season"]
        return self._request(f"/user/{user_id}/leagues/{sport}/{season}")

    def get_league(self, league_id):
        return self._request(f"/league/{league_id}")

    def get_league_rosters(self, league_id):
        return self._request(f"/league/{league_id}/rosters")

    def get_league_users(self, league_id):
        return self._request(f"/league/{league_id}/users")

    def get_league_matchups(self, league_id, week):
        return self._request(f"/league/{league_id}/matchups/{week}")

    def get_winners_bracket(self, league_id):
        return self._request(f"/league/{league_id}/winners_bracket")

    def get_losers_bracket(self, league_id):
        return self._request(f"/league/{league_id}/losers_bracket")

    def get_transactions(self, league_id, round_week):
        return self._request(f"/league/{league_id}/transactions/{round_week}")

    def get_traded_picks(self, league_id):
        return self._request(f"/league/{league_id}/traded_picks")

    def get_league_drafts(self, league_id):
        return self._request(f"/league/{league_id}/drafts")

    def get_draft(self, draft_id):
        return self._request(f"/draft/{draft_id}")

    def get_draft_picks(self, draft_id):
        return self._request(f"/draft/{draft_id}/picks")

    def get_draft_traded_picks(self, draft_id):
        return self._request(f"/draft/{draft_id}/traded_picks")

    def get_all_players(self):
        return self._request("/players/nfl")

    def get_trending_players(self, add=True, lookback_hours=24, limit=25):
        typ = "add" if add else "drop"
        return self._request(
            f"/players/nfl/trending/{typ}?lookback_hours={lookback_hours}&limit={limit}"
        )

    def get_nfl_state(self):
        return self._request("/state/nfl")
