import polars as pl
import datetime
from elfant.api.sleeper import SleeperAPI
from elfant.db.base import get_session
from elfant.db.models import (
    User, League, Roster, LeagueUser, Player, Draft, DraftPick,
    Matchup, Transaction, TradedPick, PlayoffBracket, NflState,
    PlayerWeeklyStat,
)

api = SleeperAPI()


def sync_user(user_id_or_name):
    if isinstance(user_id_or_name, dict):
        data = user_id_or_name
    else:
        data = api.get_user(user_id_or_name)
    with get_session() as session:
        user = session.get(User, data["user_id"])
        if user is None:
            user = User(user_id=data["user_id"])
            session.add(user)
        user.username = data.get("username", "")
        user.display_name = data.get("display_name", "")
        user.avatar = data.get("avatar")
        session.commit()


def sync_league(league_id):
    data = api.get_league(league_id)
    with get_session() as session:
        league = session.get(League, data["league_id"])
        if league is None:
            league = League(league_id=data["league_id"])
            session.add(league)
        league.name = data.get("name", "")
        league.season = data.get("season", "")
        league.season_type = data.get("season_type")
        league.sport = data.get("sport")
        league.status = data.get("status")
        league.total_rosters = data.get("total_rosters")
        league.settings = data.get("settings")
        league.scoring_settings = data.get("scoring_settings")
        league.roster_positions = data.get("roster_positions")
        league.previous_league_id = data.get("previous_league_id")
        league.draft_id = data.get("draft_id")
        league.avatar = data.get("avatar")
        league.league_metadata = data.get("metadata")
        league.last_synced_at = datetime.datetime.utcnow()
        session.commit()
        return league


def sync_league_chain(league_id):
    """Sync a league and all its linked previous seasons."""
    seen: set[str] = set()
    current = league_id
    while current and current not in seen:
        seen.add(current)
        with get_session() as session:
            league = session.get(League, current)
            if league:
                has_matchups = session.query(Matchup).filter_by(league_id=current).first() is not None
                if has_matchups:
                    current = league.previous_league_id
                    continue
        try:
            sync_league_all(current)
        except Exception:
            break
        with get_session() as session:
            league = session.get(League, current)
            current = league.previous_league_id if league else None


def sync_rosters(league_id):
    data = api.get_league_rosters(league_id)
    with get_session() as session:
        for rd in data:
            existing = (
                session.query(Roster)
                .filter_by(league_id=league_id, roster_id=rd["roster_id"])
                .first()
            )
            if existing is None:
                existing = Roster(league_id=league_id, roster_id=rd["roster_id"])
                session.add(existing)
            existing.owner_id = rd.get("owner_id")
            existing.settings = rd.get("settings")
            existing.starters = rd.get("starters")
            existing.players = rd.get("players")
            existing.reserve = rd.get("reserve")
        session.commit()


def sync_league_users(league_id):
    data = api.get_league_users(league_id)
    with get_session() as session:
        for ud in data:
            uid = ud["user_id"]
            user = session.get(User, uid)
            if user is None:
                user = User(user_id=uid)
                session.add(user)
            user.username = ud.get("username", "")
            user.display_name = ud.get("display_name", "")
            user.avatar = ud.get("avatar")

            lu = (
                session.query(LeagueUser)
                .filter_by(league_id=league_id, user_id=uid)
                .first()
            )
            if lu is None:
                lu = LeagueUser(league_id=league_id, user_id=uid)
                session.add(lu)
            lu.user_metadata = ud.get("metadata")
            lu.is_owner = ud.get("is_owner", False)
        session.commit()


def sync_players():
    data = api.get_all_players()
    with get_session() as session:
        for pid, pd in data.items():
            player = session.get(Player, pid)
            if player is None:
                player = Player(player_id=pid)
                session.add(player)
            player.first_name = pd.get("first_name")
            player.last_name = pd.get("last_name")
            player.team = pd.get("team")
            player.position = pd.get("position")
            player.fantasy_positions = pd.get("fantasy_positions")
            player.status = pd.get("status")
            player.height = pd.get("height")
            player.weight = pd.get("weight")
            player.age = pd.get("age")
            player.number = pd.get("number")
            player.college = pd.get("college")
            player.years_exp = pd.get("years_exp")
            player.injury_status = pd.get("injury_status")
            player.injury_start_date = pd.get("injury_start_date")
            player.sportradar_id = pd.get("sportradar_id")
            player.rotowire_id = pd.get("rotowire_id")
            player.rotoworld_id = pd.get("rotoworld_id")
            player.espn_id = pd.get("espn_id")
            player.yahoo_id = pd.get("yahoo_id")
            player.fantasy_data_id = pd.get("fantasy_data_id")
            player.stats_id = pd.get("stats_id")
            player.hashtag = pd.get("hashtag")
            player.depth_chart_position = pd.get("depth_chart_position")
            player.depth_chart_order = pd.get("depth_chart_order")
            player.search_rank = pd.get("search_rank")
            player.search_full_name = pd.get("search_full_name")
            player.search_first_name = pd.get("search_first_name")
            player.search_last_name = pd.get("search_last_name")
            player.practice_participation = pd.get("practice_participation")
            player.news_updated = pd.get("news_updated")
            player.birth_country = pd.get("birth_country")
            player.birth_city = pd.get("birth_city")
            player.birth_state = pd.get("birth_state")
            player.rookie_year = pd.get("rookie_year")
            player.injury_notes = pd.get("injury_notes")
        session.commit()


def sync_player_ids():
    """Populate gsis_id on Player records using nflreadpy's ID mapping."""
    try:
        import nflreadpy as nfl
    except ImportError:
        print("nflreadpy not installed. Run: pip install nflreadpy")
        return

    ids = nfl.load_ff_playerids().drop_nulls(subset=["sleeper_id", "gsis_id"])
    # Convert sleeper_id (Int64) → string for matching
    id_map = {str(row["sleeper_id"]): row["gsis_id"] for row in ids.iter_rows(named=True)}

    with get_session() as session:
        updated = 0
        players = session.query(Player).filter(Player.gsis_id.is_(None)).all()
        for p in players:
            gsis = id_map.get(p.player_id)
            if gsis:
                p.gsis_id = gsis
                updated += 1
        session.commit()
        print(f"Updated {updated} players with gsis_id ({len(players) - updated} unmapped)")


# Known NFL team abbreviations (defense stats use these as player_id)
_TEAM_ABBREVIATIONS: set[str] = {
    "ARI", "ATL", "BAL", "BUF", "CAR", "CHI", "CIN", "CLE",
    "DAL", "DEN", "DET", "GB",  "HOU", "IND", "JAX", "KC",
    "LAC", "LAR", "LV",  "MIA", "MIN", "NE",  "NO",  "NYG",
    "NYJ", "PHI", "PIT", "SEA", "SF",  "TB",  "TEN", "WAS",
}

_TEAM_NAMES: dict[str, str] = {
    "ARI": "Arizona", "ATL": "Atlanta", "BAL": "Baltimore", "BUF": "Buffalo",
    "CAR": "Carolina", "CHI": "Chicago", "CIN": "Cincinnati", "CLE": "Cleveland",
    "DAL": "Dallas", "DEN": "Denver", "DET": "Detroit", "GB": "Green Bay",
    "HOU": "Houston", "IND": "Indianapolis", "JAX": "Jacksonville", "KC": "Kansas City",
    "LAC": "LA Chargers", "LAR": "LA Rams", "LV": "Las Vegas", "MIA": "Miami",
    "MIN": "Minnesota", "NE": "New England", "NO": "New Orleans", "NYG": "NY Giants",
    "NYJ": "NY Jets", "PHI": "Philadelphia", "PIT": "Pittsburgh", "SEA": "Seattle",
    "SF": "San Francisco", "TB": "Tampa Bay", "TEN": "Tennessee", "WAS": "Washington",
}

# Map nflreadpy team abbreviations → Sleeper player_ids (handles relocations)
_NFLRADPY_TO_SLEEPER_TEAM: dict[str, str] = {
    "LA": "LAR",   # nflreadpy uses "LA" for Rams, Sleeper uses "LAR"
    "OAK": "LV",   # Raiders moved from Oakland to Las Vegas after 2019
}

def sync_player_weekly_stats(seasons=None):
    """Upsert weekly NFL stats from nflverse for all mapped players.

    Args:
        seasons: list of int years, e.g. [2023, 2024]. Defaults to current year.
    """
    try:
        import nflreadpy as nfl
    except ImportError:
        print("nflreadpy not installed. Run: pip install nflreadpy")
        return

    # Ensure ID mapping is populated
    sync_player_ids()

    if seasons is None:
        import datetime
        seasons = [datetime.date.today().year]

    # Load ID map: gsis_id → sleeper_id
    ids = nfl.load_ff_playerids().drop_nulls(subset=["sleeper_id", "gsis_id"])
    gsis_to_sleeper = {}
    for row in ids.iter_rows(named=True):
        gsis_to_sleeper[row["gsis_id"]] = str(row["sleeper_id"])

    # Build a set of (sleeper_id, season, week, season_type) already in DB for fast skip
    with get_session() as session:
        existing = set()
        for row in session.query(
            PlayerWeeklyStat.player_id,
            PlayerWeeklyStat.season,
            PlayerWeeklyStat.week,
            PlayerWeeklyStat.season_type,
        ).filter(
            PlayerWeeklyStat.season.in_(seasons),
        ).all():
            existing.add((row.player_id, row.season, row.week, row.season_type or "REG"))

    # Map nflreadpy stat columns → model column names
    STAT_FIELDS = [
        ("completions", "completions"),
        ("attempts", "attempts"),
        ("passing_yards", "passing_yards"),
        ("passing_tds", "passing_tds"),
        ("passing_interceptions", "passing_interceptions"),
        ("passing_2pt_conversions", "passing_2pt_conversions"),
        ("sacks_suffered", "sacks_suffered"),
        ("carries", "carries"),
        ("rushing_yards", "rushing_yards"),
        ("rushing_tds", "rushing_tds"),
        ("rushing_2pt_conversions", "rushing_2pt_conversions"),
        ("rushing_fumbles", "rushing_fumbles"),
        ("rushing_fumbles_lost", "rushing_fumbles_lost"),
        ("receptions", "receptions"),
        ("targets", "targets"),
        ("receiving_yards", "receiving_yards"),
        ("receiving_tds", "receiving_tds"),
        ("receiving_2pt_conversions", "receiving_2pt_conversions"),
        ("receiving_fumbles", "receiving_fumbles"),
        ("receiving_fumbles_lost", "receiving_fumbles_lost"),
        ("special_teams_tds", "special_teams_tds"),
        ("fg_made", "fg_made"),
        ("fg_att", "fg_att"),
        ("fg_made_0_19", "fg_made_0_19"),
        ("fg_made_20_29", "fg_made_20_29"),
        ("fg_made_30_39", "fg_made_30_39"),
        ("fg_made_40_49", "fg_made_40_49"),
        ("fg_made_50_59", "fg_made_50_59"),
        ("fg_made_60_", "fg_made_60_"),
        ("pat_made", "pat_made"),
        ("pat_att", "pat_att"),
        ("def_tackles_solo", "def_tackles_solo"),
        ("def_tackles_with_assist", "def_tackles_with_assist"),
        ("def_tackles_for_loss", "def_tackles_for_loss"),
        ("def_sacks", "def_sacks"),
        ("def_interceptions", "def_interceptions"),
        ("def_pass_defended", "def_pass_defended"),
        ("def_fumbles_forced", "def_fumbles_forced"),
        ("def_tds", "def_tds"),
        ("def_safeties", "def_safeties"),
        ("def_sack_yards", "def_sack_yards"),
        ("def_interception_yards", "def_interception_yards"),
        ("def_fumbles", "def_fumbles"),
        ("def_qb_hits", "def_qb_hits"),
        ("kickoff_return_yards", "kickoff_return_yards"),
        ("kickoff_returns", "kickoff_returns"),
        ("punt_return_yards", "punt_return_yards"),
        ("punt_returns", "punt_returns"),
        ("target_share", "target_share"),
        ("air_yards", "air_yards"),
        ("racr", "racr"),
        ("wopr", "wopr"),
        ("passing_air_yards", "passing_air_yards"),
        ("passing_epa", "passing_epa"),
        ("receiving_epa", "receiving_epa"),
        ("rushing_epa", "rushing_epa"),
        ("fg_missed", "fg_missed"),
        ("pat_missed", "pat_missed"),
        ("fg_blocked", "fg_blocked"),
    ]

    for season in seasons:
        print(f"Loading player stats for {season}...")
        df = nfl.load_player_stats(seasons=[season])

        total = len(df)
        inserted = 0
        skipped = 0
        batch = []

        for row in df.iter_rows(named=True):
            pid = row["player_id"]
            sleeper_id = gsis_to_sleeper.get(pid)
            if not sleeper_id:
                if pid and pid in _TEAM_ABBREVIATIONS:
                    sleeper_id = pid
                else:
                    skipped += 1
                    continue

            season_type = row.get("season_type") or "REG"
            key = (sleeper_id, row["season"], row["week"], season_type)
            if key in existing:
                skipped += 1
                continue

            vals = {
                "player_id": sleeper_id,
                "season": row["season"],
                "week": row["week"],
                "season_type": season_type,
                "team": row.get("team"),
                "opponent": row.get("opponent_team"),
            }
            for nfl_key, model_key in STAT_FIELDS:
                v = row.get(nfl_key)
                if v is not None and not (isinstance(v, float) and v != v):
                    vals[model_key] = int(v) if isinstance(v, float) and v == v and v == int(v) else v

            # Compute total fumbles from components
            rf = vals.get("rushing_fumbles") or 0
            recf = vals.get("receiving_fumbles") or 0
            vals["fumbles"] = rf + recf
            rfl = vals.get("rushing_fumbles_lost") or 0
            refl = vals.get("receiving_fumbles_lost") or 0
            vals["fumbles_lost"] = rfl + refl

            batch.append(PlayerWeeklyStat(**vals))
            inserted += 1

            if len(batch) >= 500:
                with get_session() as session:
                    session.add_all(batch)
                    session.commit()
                batch = []

        if batch:
            with get_session() as session:
                session.add_all(batch)
                session.commit()

        print(f"  {season}: {inserted} inserted, {skipped} skipped (of {total} total rows)")

    print("Done.")


def sync_team_player_records():
    """Create Player records for NFL teams (defenses) if they don't exist."""
    with get_session() as session:
        for abbr, name in _TEAM_NAMES.items():
            existing = session.get(Player, abbr)
            if not existing:
                session.add(Player(
                    player_id=abbr,
                    first_name=name,
                    last_name="D/ST",
                    position="DEF",
                    team=abbr,
                    active=True,
                    status="Active",
                ))
        session.commit()
    print(f"Synced {len(_TEAM_NAMES)} team player records.")


_DEF_STAT_FIELDS = [
    ("def_tackles_solo", "def_tackles_solo"),
    ("def_tackles_with_assist", "def_tackles_with_assist"),
    ("def_tackles_for_loss", "def_tackles_for_loss"),
    ("def_sacks", "def_sacks"),
    ("def_interceptions", "def_interceptions"),
    ("def_pass_defended", "def_pass_defended"),
    ("def_fumbles_forced", "def_fumbles_forced"),
    ("def_tds", "def_tds"),
    ("def_safeties", "def_safeties"),
    ("special_teams_tds", "special_teams_tds"),
    ("fg_missed", "fg_missed"),
    ("pat_missed", "pat_missed"),
    ("fg_blocked", "fg_blocked"),
    ("pat_blocked", "pat_blocked"),
    ("fumble_recovery_opp", "fumble_recovery_opp"),
    ("fumble_recovery_tds", "fumble_recovery_tds"),
    ("def_sack_yards", "def_sack_yards"),
    ("def_interception_yards", "def_interception_yards"),
    ("def_fumbles", "def_fumbles"),
    ("def_qb_hits", "def_qb_hits"),
]


def sync_team_weekly_stats(seasons=None):
    """Upsert weekly team defense stats from nflverse."""
    try:
        import nflreadpy as nfl
    except ImportError:
        print("nflreadpy not installed. Run: pip install nflreadpy")
        return

    sync_team_player_records()

    if seasons is None:
        import datetime
        seasons = [datetime.date.today().year]

    with get_session() as session:
        existing = set()
        for row in session.query(
            PlayerWeeklyStat.player_id,
            PlayerWeeklyStat.season,
            PlayerWeeklyStat.week,
            PlayerWeeklyStat.season_type,
        ).filter(
            PlayerWeeklyStat.season.in_(seasons),
            PlayerWeeklyStat.player_id.in_(list(_TEAM_ABBREVIATIONS)),
        ).all():
            existing.add((row.player_id, row.season, row.week, row.season_type or "REG"))

    for season in seasons:
        print(f"Loading team defense stats for {season}...")
        df = nfl.load_team_stats(seasons=[season])
        total = len(df)
        inserted = 0
        skipped = 0
        batch = []

        for row in df.iter_rows(named=True):
            raw_team = row["team"]
            pid = _NFLRADPY_TO_SLEEPER_TEAM.get(raw_team, raw_team)
            if pid not in _TEAM_ABBREVIATIONS:
                skipped += 1
                continue

            season_type = row.get("season_type") or "REG"
            key = (pid, row["season"], row["week"], season_type)
            if key in existing:
                skipped += 1
                continue

            vals: dict = {
                "player_id": pid,
                "season": row["season"],
                "week": row["week"],
                "season_type": season_type,
                "team": pid,
                "opponent": row.get("opponent_team"),
            }
            for nfl_key, model_key in _DEF_STAT_FIELDS:
                v = row.get(nfl_key)
                if v is not None and not (isinstance(v, float) and v != v):
                    vals[model_key] = int(v) if isinstance(v, float) and v == v and v == int(v) else v

            batch.append(PlayerWeeklyStat(**vals))
            inserted += 1

            if len(batch) >= 500:
                with get_session() as session:
                    session.add_all(batch)
                    session.commit()
                batch = []

        if batch:
            with get_session() as session:
                session.add_all(batch)
                session.commit()

        print(f"  {season}: {inserted} inserted, {skipped} skipped (of {total} total rows)")

    print("Done.")


def sync_team_defense_opp_stats(seasons=None):
    """Update defense PlayerWeeklyStat rows with points/yards allowed."""
    try:
        import nflreadpy as nfl
    except ImportError:
        print("nflreadpy not installed. Run: pip install nflreadpy")
        return

    if seasons is None:
        import datetime
        seasons = [datetime.date.today().year]

    for season in seasons:
        print(f"Loading data for {season} to compute defense allowed stats...")
        sched = nfl.load_schedules(seasons=[season])
        sched = sched.filter(
            sched["season"] == season,
            sched["week"].is_not_null(),
            sched["home_score"].is_not_null(),
            sched["away_score"].is_not_null(),
        )

        team_stats = nfl.load_team_stats(seasons=[season])

        # Build map: (team, season, week) → total offensive yards
        off_yards: dict[tuple[str, int, int], int] = {}
        for row in team_stats.iter_rows(named=True):
            key = (row["team"], row["season"], row["week"])
            off_yards[key] = (row["passing_yards"] or 0) + (row["rushing_yards"] or 0)

        updates_pts = 0
        updates_yds = 0
        with get_session() as session:
            for row in sched.iter_rows(named=True):
                home = row["home_team"]
                away = row["away_team"]
                home_pts = row["home_score"]
                away_pts = row["away_score"]
                week = row["week"]

                for team, pts_allowed in [(home, away_pts), (away, home_pts)]:
                    pid = _NFLRADPY_TO_SLEEPER_TEAM.get(team, team)
                    if pid not in _TEAM_ABBREVIATIONS:
                        continue

                    stat = session.query(PlayerWeeklyStat).filter(
                        PlayerWeeklyStat.player_id == pid,
                        PlayerWeeklyStat.season == season,
                        PlayerWeeklyStat.week == week,
                    ).first()
                    if stat:
                        stat.pts_allowed = float(pts_allowed)
                        updates_pts += 1

            # Update yards allowed + new stat columns from team stats
            for row in team_stats.iter_rows(named=True):
                team = row["team"]
                pid = _NFLRADPY_TO_SLEEPER_TEAM.get(team, team)
                if pid not in _TEAM_ABBREVIATIONS:
                    continue

                opp_key = (row["opponent_team"], row["season"], row["week"])
                yds = off_yards.get(opp_key)
                if yds is None:
                    continue

                stat = session.query(PlayerWeeklyStat).filter(
                    PlayerWeeklyStat.player_id == pid,
                    PlayerWeeklyStat.season == season,
                    PlayerWeeklyStat.week == row["week"],
                ).first()
                if stat:
                    stat.yds_allowed = yds
                    stat.fg_missed = row.get("fg_missed")
                    stat.pat_missed = row.get("pat_missed")
                    stat.fg_blocked = row.get("fg_blocked")
                    stat.pat_blocked = row.get("pat_blocked")
                    stat.fumble_recovery_opp = row.get("fumble_recovery_opp")
                    stat.fumble_recovery_tds = row.get("fumble_recovery_tds")
                    # Compute FG yardage bonus from fg_made_list
                    fg_list = row.get("fg_made_list")
                    bonus = 0
                    if fg_list:
                        for d in str(fg_list).split(";"):
                            d = d.strip()
                            if d:
                                bonus += max(0, int(d) - 30)
                    stat.fg_yds_bonus = bonus
                    updates_yds += 1

            session.commit()

        print(f"  {season}: {updates_pts} pts_allowed, {updates_yds} yds_allowed updated")

    print("Done.")


def sync_defense_pbp_stats(seasons=None):
    """Update defense PlayerWeeklyStat with 4th-down stops and 3-and-outs from PBP."""
    try:
        import nflreadpy as nfl
    except ImportError:
        print("nflreadpy not installed. Run: pip install nflreadpy")
        return

    if seasons is None:
        import datetime
        seasons = [datetime.date.today().year]

    for season in seasons:
        print(f"Loading PBP for {season} to compute defense situational stats...")
        pbp = nfl.load_pbp(seasons=[season])

        # 4th down stops
        stops = (
            pbp.filter(pbp["fourth_down_failed"] == 1)
            .group_by(["defteam", "season", "week"])
            .agg(pl.col("game_id").count().alias("def_4_and_stop"))
        )

        # 3-and-outs: drives with ≤3 plays ending in punt/TO-on-downs/missed FG
        drives = (
            pbp.group_by(["game_id", "defteam", "drive"])
            .agg([
                pl.col("drive_play_count").first(),
                pl.col("fixed_drive_result").first(),
                pl.col("season").first(),
                pl.col("week").first(),
            ])
            .filter(
                pl.col("drive_play_count").is_not_null()
                & pl.col("drive_play_count").is_not_nan()
                & (pl.col("fixed_drive_result") != "End of half")
            )
        )
        three_outs = (
            drives.filter(
                (pl.col("drive_play_count") <= 3)
                & pl.col("fixed_drive_result").is_in(
                    ["Punt", "Turnover on downs", "Missed field goal"]
                )
            )
            .group_by(["defteam", "season", "week"])
            .agg(pl.col("game_id").count().alias("def_3_and_out"))
        )

        # Blocked kicks (punts, FGs, PATs) from PBP — more complete than team_stats
        kicks_blocked = (
            pbp.filter(
                (pl.col("punt_blocked") == 1)
                | (pl.col("extra_point_result") == "blocked")
                | (pl.col("field_goal_result") == "blocked")
            )
            .group_by(["defteam", "season", "week"])
            .agg(pl.col("game_id").count().alias("kicks_blocked"))
        )

        updates = 0
        with get_session() as session:
            # Update from stops
            for row in stops.iter_rows(named=True):
                pid = _NFLRADPY_TO_SLEEPER_TEAM.get(row["defteam"], row["defteam"])
                if pid not in _TEAM_ABBREVIATIONS:
                    continue
                stat = session.query(PlayerWeeklyStat).filter(
                    PlayerWeeklyStat.player_id == pid,
                    PlayerWeeklyStat.season == row["season"],
                    PlayerWeeklyStat.week == row["week"],
                ).first()
                if stat:
                    stat.def_4_and_stop = row["def_4_and_stop"]
                    updates += 1

            # Update from 3-and-outs
            for row in three_outs.iter_rows(named=True):
                pid = _NFLRADPY_TO_SLEEPER_TEAM.get(row["defteam"], row["defteam"])
                if pid not in _TEAM_ABBREVIATIONS:
                    continue
                stat = session.query(PlayerWeeklyStat).filter(
                    PlayerWeeklyStat.player_id == pid,
                    PlayerWeeklyStat.season == row["season"],
                    PlayerWeeklyStat.week == row["week"],
                ).first()
                if stat:
                    stat.def_3_and_out = row["def_3_and_out"]
                    updates += 1

            # Update from all blocked kicks (punts, FGs, PATs)
            for row in kicks_blocked.iter_rows(named=True):
                pid = _NFLRADPY_TO_SLEEPER_TEAM.get(row["defteam"], row["defteam"])
                if pid not in _TEAM_ABBREVIATIONS:
                    continue
                stat = session.query(PlayerWeeklyStat).filter(
                    PlayerWeeklyStat.player_id == pid,
                    PlayerWeeklyStat.season == row["season"],
                    PlayerWeeklyStat.week == row["week"],
                ).first()
                if stat:
                    stat.kicks_blocked = row["kicks_blocked"]
                    updates += 1

            session.commit()

        print(f"  {season}: {updates} defense situational stats updated")

    print("Done.")


def sync_drafts(league_id):
    data = api.get_league_drafts(league_id)
    with get_session() as session:
        for dd in data:
            draft = session.get(Draft, dd["draft_id"])
            if draft is None:
                draft = Draft(draft_id=dd["draft_id"])
                session.add(draft)
            draft.league_id = dd.get("league_id")
            draft.type = dd.get("type")
            draft.status = dd.get("status")
            draft.start_time = dd.get("start_time")
            draft.sport = dd.get("sport")
            draft.settings = dd.get("settings")
            draft.season = dd.get("season")
            draft.season_type = dd.get("season_type")
            draft.draft_metadata = dd.get("metadata")
            draft.draft_order = dd.get("draft_order")
            draft.slot_to_roster_id = dd.get("slot_to_roster_id")
            draft.created = dd.get("created")
        session.commit()


def sync_draft_picks(draft_id):
    data = api.get_draft_picks(draft_id)
    with get_session() as session:
        for pd in data:
            existing = (
                session.query(DraftPick)
                .filter_by(draft_id=draft_id, pick_no=pd["pick_no"])
                .first()
            )
            if existing is None:
                existing = DraftPick(draft_id=draft_id, pick_no=pd["pick_no"])
                session.add(existing)
            existing.round = pd.get("round")
            existing.roster_id = pd.get("roster_id")
            existing.draft_slot = pd.get("draft_slot")
            existing.player_id = pd.get("player_id")
            existing.picked_by = pd.get("picked_by")
            existing.is_keeper = pd.get("is_keeper")
            existing.pick_metadata = pd.get("metadata")
        session.commit()


def sync_matchups(league_id, week):
    data = api.get_league_matchups(league_id, week)
    with get_session() as session:
        for md in data:
            existing = (
                session.query(Matchup)
                .filter_by(league_id=league_id, week=week, roster_id=md["roster_id"])
                .first()
            )
            if existing is None:
                existing = Matchup(league_id=league_id, week=week, roster_id=md["roster_id"])
                session.add(existing)
            existing.matchup_id = md.get("matchup_id")
            existing.points = md.get("points")
            existing.custom_points = md.get("custom_points")
            existing.starters = md.get("starters")
            existing.players = md.get("players")
            existing.starters_points = md.get("starters_points")
            existing.players_points = md.get("players_points")
        session.commit()


def sync_transactions(league_id, week):
    data = api.get_transactions(league_id, week)
    with get_session() as session:
        for td in data:
            txn = session.get(Transaction, td["transaction_id"])
            if txn is None:
                txn = Transaction(transaction_id=td["transaction_id"])
                session.add(txn)
            txn.league_id = td.get("league_id") or league_id
            txn.type = td.get("type")
            txn.status = td.get("status")
            txn.status_updated = td.get("status_updated")
            txn.settings = td.get("settings")
            txn.roster_ids = td.get("roster_ids")
            txn.leg = td.get("leg")
            # Snapshot player team/position at sync time for historical accuracy
            meta = td.get("metadata") or {}
            player_teams = {}
            for pid in (td.get("adds") or {}):
                player = session.get(Player, pid) if pid and str(pid).isdigit() else None
                if player:
                    player_teams[pid] = {
                        "team": player.team,
                        "position": player.position,
                        "name": f"{player.first_name} {player.last_name}".strip(),
                    }
            for pid in (td.get("drops") or {}):
                if pid not in player_teams:
                    player = session.get(Player, pid) if pid and str(pid).isdigit() else None
                    if player:
                        player_teams[pid] = {
                            "team": player.team,
                            "position": player.position,
                            "name": f"{player.first_name} {player.last_name}".strip(),
                        }
            meta["_player_teams"] = player_teams
            txn.txn_metadata = meta
            txn.drops = td.get("drops")
            txn.draft_picks = td.get("draft_picks")
            txn.creator = td.get("creator")
            txn.created = td.get("created")
            txn.consenter_ids = td.get("consenter_ids")
            txn.adds = td.get("adds")
            txn.waiver_budget = td.get("waiver_budget")
        session.commit()


def sync_traded_picks(league_id):
    data = api.get_traded_picks(league_id)
    with get_session() as session:
        for tpd in data:
            existing = (
                session.query(TradedPick)
                .filter_by(
                    league_id=league_id,
                    season=tpd["season"],
                    round=tpd["round"],
                    roster_id=tpd["roster_id"],
                )
                .first()
            )
            if existing is None:
                existing = TradedPick(
                    league_id=league_id,
                    season=tpd["season"],
                    round=tpd["round"],
                    roster_id=tpd["roster_id"],
                )
                session.add(existing)
            existing.previous_owner_id = tpd.get("previous_owner_id")
            existing.owner_id = tpd.get("owner_id")
        session.commit()


def sync_nfl_state():
    data = api.get_nfl_state()
    with get_session() as session:
        state = session.query(NflState).order_by(NflState.id.desc()).first()
        if state is None:
            state = NflState()
            session.add(state)
        state.week = data.get("week")
        state.season = data.get("season")
        state.season_type = data.get("season_type")
        state.season_start_date = data.get("season_start_date")
        state.previous_season = data.get("previous_season")
        state.leg = data.get("leg")
        state.league_season = data.get("league_season")
        state.league_create_season = data.get("league_create_season")
        state.display_week = data.get("display_week")
        session.commit()


def get_league_week_count(league_id):
    for w in range(1, 23):
        data = api.get_league_matchups(league_id, w)
        if not data:
            return w - 1
    return 22


def sync_league_all(league_id):
    sync_league(league_id)
    sync_league_users(league_id)
    sync_rosters(league_id)
    sync_drafts(league_id)

    with get_session() as session:
        league = session.get(League, league_id)

    if league and league.draft_id:
        sync_draft_picks(league.draft_id)

    weeks = get_league_week_count(league_id)
    for w in range(1, weeks + 1):
        sync_matchups(league_id, w)
        sync_transactions(league_id, w)

    sync_traded_picks(league_id)
    sync_playoffs(league_id)


def sync_bracket(league_id, bracket_type):
    if bracket_type == "winners":
        data = api.get_winners_bracket(league_id)
    else:
        data = api.get_losers_bracket(league_id)

    if not data:
        return

    with get_session() as session:
        session.query(PlayoffBracket).filter_by(
            league_id=league_id, bracket_type=bracket_type
        ).delete()
        for md in data:
            b = PlayoffBracket(
                league_id=league_id,
                bracket_type=bracket_type,
                round=md["r"],
                match_id=md["m"],
                team_1=md.get("t1"),
                team_2=md.get("t2"),
                team_1_from=md.get("t1_from"),
                team_2_from=md.get("t2_from"),
                winner=md.get("w"),
                loser=md.get("l"),
                position=md.get("p"),
            )
            session.add(b)
        session.commit()


def sync_playoffs(league_id):
    sync_bracket(league_id, "winners")
    sync_bracket(league_id, "losers")


def sync_player_snap_counts(seasons=None):
    """Sync per-player snap counts from nflreadpy for defensive players."""
    try:
        import nflreadpy as nfl
    except ImportError:
        print("nflreadpy not installed. Run: pip install nflreadpy")
        return

    if seasons is None:
        import datetime
        seasons = [datetime.date.today().year]

    # Build PFR → sleeper ID map
    ids = nfl.load_ff_playerids().drop_nulls(subset=["pfr_id", "gsis_id"])
    pfr_to_sleeper: dict[str, str] = {}
    for row in ids.iter_rows(named=True):
        gsis = row["gsis_id"]
        # Find sleeper_id from our DB
        with get_session() as session:
            player = session.query(Player).filter(
                Player.gsis_id == gsis,
                Player.position.in_(["CB", "DB", "DE", "DT", "LB", "S", "SS", "FS", "NT", "OLB", "ILB", "MLB"]),
            ).first()
            if player:
                pfr_to_sleeper[row["pfr_id"]] = player.player_id

    for season in seasons:
        print(f"Loading snap counts for {season}...")
        df = nfl.load_snap_counts(seasons=[season])
        if df is None or len(df) == 0:
            print(f"  No snap data for {season}")
            continue

        from sqlalchemy import bindparam, text

        upserted = 0
        updates: list[dict] = []
        inserts: list[dict] = []

        for row in df.iter_rows(named=True):
            pfr_id = row.get("pfr_player_id")
            sleeper_id = pfr_to_sleeper.get(pfr_id)
            if not sleeper_id:
                continue
            season_type = row.get("game_type") or "REG"
            rec = {
                "player_id": sleeper_id,
                "season": row["season"],
                "week": row["week"],
                "season_type": season_type,
                "team": row.get("team"),
                "opponent": row.get("opponent"),
                "offense_snaps": row.get("offense_snaps"),
                "defense_snaps": row.get("defense_snaps"),
                "st_snaps": row.get("st_snaps"),
                "offense_pct": row.get("offense_pct"),
                "defense_pct": row.get("defense_pct"),
                "st_pct": row.get("st_pct"),
            }
            updates.append(rec)
            upserted += 1

        if updates:
            with get_session() as session:
                stmt = text("""
                    INSERT INTO player_weekly_stats
                        (player_id, season, week, season_type, team, opponent,
                         offense_snaps, defense_snaps, st_snaps,
                         offense_pct, defense_pct, st_pct)
                    VALUES
                        (:player_id, :season, :week, :season_type, :team, :opponent,
                         :offense_snaps, :defense_snaps, :st_snaps,
                         :offense_pct, :defense_pct, :st_pct)
                    ON CONFLICT (player_id, season, week, season_type)
                    DO UPDATE SET
                        offense_snaps = EXCLUDED.offense_snaps,
                        defense_snaps = EXCLUDED.defense_snaps,
                        st_snaps = EXCLUDED.st_snaps,
                        offense_pct = EXCLUDED.offense_pct,
                        defense_pct = EXCLUDED.defense_pct,
                        st_pct = EXCLUDED.st_pct
                """)
                session.execute(stmt, updates)
                session.commit()

        print(f"  {season}: {upserted} snap records")

    print("Done.")


def sync_defense_time_of_possession(seasons=None):
    """Sync time of possession and plays faced for team defenses from PBP."""
    try:
        import nflreadpy as nfl
    except ImportError:
        print("nflreadpy not installed. Run: pip install nflreadpy")
        return

    if seasons is None:
        import datetime
        seasons = [datetime.date.today().year]

    for season in seasons:
        print(f"Loading defense time of possession for {season}...")
        pbp = nfl.load_pbp(seasons=[season])

        def _top_to_secs(top: str | None) -> int:
            if not top:
                return 0
            try:
                parts = top.split(":")
                return int(parts[0]) * 60 + int(parts[1])
            except (ValueError, IndexError):
                return 0

        # Unique drives per game
        drives = (
            pbp.filter(
                pl.col("drive_time_of_possession").is_not_null()
                & pl.col("defteam").is_not_null()
            )
            .select(["game_id", "defteam", "drive", "drive_time_of_possession", "season", "week"])
            .unique()
        )

        # Convert TOP to seconds and sum per defteam per game - iterate rows in Python
        top_by_game: dict[tuple, int] = {}
        drives_by_game: dict[tuple, set] = {}
        for row in drives.iter_rows(named=True):
            key = (row["game_id"], row["defteam"], row["season"], row["week"])
            top_by_game[key] = top_by_game.get(key, 0) + _top_to_secs(row.get("drive_time_of_possession"))
            if key not in drives_by_game:
                drives_by_game[key] = set()
            drives_by_game[key].add(row["drive"])

        # Aggregate plays per defensive team per game
        plays_by_game: dict[tuple, int] = {}
        for row in pbp.filter(pl.col("defteam").is_not_null()).iter_rows(named=True):
            key = (row["game_id"], row["defteam"], row["season"], row["week"])
            plays_by_game[key] = plays_by_game.get(key, 0) + 1

        # Total plays per game (both teams)
        total_plays_by_game: dict[str, int] = {}
        for (game_id, team, season_num, week), count in plays_by_game.items():
            gk = f"{game_id}_{season_num}_{week}"
            total_plays_by_game[gk] = total_plays_by_game.get(gk, 0) + count

        updates = 0
        with get_session() as session:
            for key, top_secs in top_by_game.items():
                game_id, team, season_num, week = key
                if team not in _TEAM_ABBREVIATIONS:
                    continue
                def_plays_count = plays_by_game.get(key, 0)
                gk = f"{game_id}_{season_num}_{week}"
                total_count = total_plays_by_game.get(gk, 0)
                stat = session.query(PlayerWeeklyStat).filter_by(
                    player_id=team,
                    season=season_num,
                    week=week,
                ).first()
                if stat:
                    stat.def_time_of_possession = top_secs
                    stat.def_plays = def_plays_count
                    stat.total_plays = total_count
                    updates += 1
            session.commit()

        print(f"  {season}: {updates} team-defense TOP records updated")

    print("Done.")


def sync_migrate_new_columns(seasons=None):
    """One-time migration: upsert new stat columns for existing rows from nflreadpy."""
    try:
        import nflreadpy as nfl
    except ImportError:
        print("nflreadpy not installed")
        return

    if seasons is None:
        import datetime
        seasons = [datetime.date.today().year]

    _NEW_FIELDS = [
        ("def_sack_yards", "def_sack_yards"),
        ("def_interception_yards", "def_interception_yards"),
        ("def_fumbles", "def_fumbles"),
        ("def_qb_hits", "def_qb_hits"),
        ("kickoff_return_yards", "kickoff_return_yards"),
        ("kickoff_returns", "kickoff_returns"),
        ("punt_return_yards", "punt_return_yards"),
        ("punt_returns", "punt_returns"),
        ("target_share", "target_share"),
        ("air_yards", "air_yards"),
        ("racr", "racr"),
        ("wopr", "wopr"),
        ("passing_air_yards", "passing_air_yards"),
        ("passing_epa", "passing_epa"),
        ("receiving_epa", "receiving_epa"),
        ("rushing_epa", "rushing_epa"),
        ("fg_missed", "fg_missed"),
        ("pat_missed", "pat_missed"),
        ("fg_blocked", "fg_blocked"),
    ]

    from sqlalchemy import bindparam, text

    for season in seasons:
        print(f"Migrating new columns for {season}...")
        df = nfl.load_player_stats(seasons=[season])

        updates = []
        gsis_to_sleeper = {}
        ids = nfl.load_ff_playerids().drop_nulls(subset=["sleeper_id", "gsis_id"])
        for row in ids.iter_rows(named=True):
            gsis_to_sleeper[row["gsis_id"]] = str(row["sleeper_id"])

        for row in df.iter_rows(named=True):
            pid = row["player_id"]
            sleeper_id = gsis_to_sleeper.get(pid)
            if not sleeper_id:
                if pid and pid in _TEAM_ABBREVIATIONS:
                    sleeper_id = pid
                else:
                    continue
            rec = {"player_id": sleeper_id, "season": row["season"], "week": row["week"], "season_type": row.get("season_type") or "REG"}
            # Initialize all fields to 0
            for _, model in _NEW_FIELDS:
                rec[model] = 0
            rec["fumbles"] = 0
            rec["fumbles_lost"] = 0
            for nf, model in _NEW_FIELDS:
                v = row.get(nf)
                if v is not None and not (isinstance(v, float) and v != v):
                    rec[model] = int(v) if isinstance(v, float) and v == v and v == int(v) else v
            # Fumbles from components
            rf = row.get("rushing_fumbles") or 0
            recf = row.get("receiving_fumbles") or 0
            rec["fumbles"] = rf + recf
            rfl = row.get("rushing_fumbles_lost") or 0
            refl = row.get("receiving_fumbles_lost") or 0
            rec["fumbles_lost"] = rfl + refl
            updates.append(rec)

        if updates:
            extra_cols = ["fumbles", "fumbles_lost"]
            all_new_cols = _NEW_FIELDS + [("fumbles", "fumbles"), ("fumbles_lost", "fumbles_lost")]
            set_clause = ", ".join(f"{col} = EXCLUDED.{col}" for _, col in all_new_cols)
            col_names = ", ".join(c for _, c in all_new_cols)
            bind_names = ", ".join(f":{c}" for _, c in all_new_cols)
            stmt = text(f"""
                INSERT INTO player_weekly_stats (player_id, season, week, season_type, {col_names})
                VALUES (:player_id, :season, :week, :season_type, {bind_names})
                ON CONFLICT (player_id, season, week, season_type)
                DO UPDATE SET {set_clause}
            """)
            with get_session() as session:
                session.execute(stmt, updates)
                session.commit()
            print(f"  {season}: {len(updates)} rows migrated")

    print("Done.")


def sync_injuries(seasons=None):
    """Sync weekly injury data from nflreadpy to Player.injury_notes."""
    try:
        import nflreadpy as nfl
    except ImportError:
        print("nflreadpy not installed. Run: pip install nflreadpy")
        return

    if seasons is None:
        import datetime
        seasons = [datetime.date.today().year]

    for season in seasons:
        print(f"Loading injuries for {season}...")
        df = nfl.load_injuries(seasons=[season])
        if df is None or len(df) == 0:
            print(f"  No injury data for {season}")
            continue

        updated = 0
        with get_session() as session:
            for row in df.iter_rows(named=True):
                gsis = row.get("gsis_id")
                if not gsis:
                    continue
                practice = row.get("practice_status") or row.get("injury", "")
                desc = row.get("description") or ""
                notes = f"{practice}: {desc}" if desc else practice
                player = session.query(Player).filter(Player.gsis_id == gsis).first()
                if player:
                    if notes:
                        player.injury_notes = notes
                        updated += 1
            session.commit()
        print(f"  {season}: {updated} players updated")

    print("Done.")


def sync_nextgen_stats(seasons=None):
    """Sync Next Gen Stats for advanced passing metrics (uses player_gsis_id)."""
    try:
        import nflreadpy as nfl
    except ImportError:
        print("nflreadpy not installed. Run: pip install nflreadpy")
        return

    if seasons is None:
        import datetime
        seasons = [datetime.date.today().year]

    _NGS_FIELDS = [
        ("avg_intended_air_yards", "passing_air_yards"),
        ("completion_percentage_above_expectation", "passing_cpoe"),
    ]

    for season in seasons:
        print(f"Loading Next Gen Stats for {season}...")
        try:
            df = nfl.load_nextgen_stats(seasons=[season])
        except Exception as e:
            print(f"  Error: {e}")
            continue
        if df is None or len(df) == 0:
            print(f"  No NGS data")
            continue

        updates = 0
        for row in df.iter_rows(named=True):
            gsis = row.get("player_gsis_id")
            if not gsis:
                continue
            with get_session() as session:
                player = session.query(Player).filter(Player.gsis_id == gsis).first()
                if not player:
                    continue
                stat = session.query(PlayerWeeklyStat).filter_by(
                    player_id=player.player_id,
                    season=row.get("season"),
                    week=row.get("week"),
                ).first()
                if stat:
                    for nf, model in _NGS_FIELDS:
                        v = row.get(nf)
                        if v is not None:
                            setattr(stat, model, v)
                    updates += 1
                    session.commit()
        print(f"  {season}: {updates} NGS records")

    print("Done.")


def sync_ftn_charting(seasons=None):
    """Sync FTN charting data. Note: requires player ID mapping, skipped if unavailable."""
    try:
        import nflreadpy as nfl
    except ImportError:
        print("nflreadpy not installed")
        return

    if seasons is None:
        import datetime
        seasons = [datetime.date.today().year]

    for season in seasons:
        print(f"FTN charting for {season} requires player ID mapping — skipping (data available via nfl.read_csv if needed)")
    print("Done.")
