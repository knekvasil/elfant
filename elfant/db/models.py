from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, BigInteger, Boolean, DateTime,
    Text, Float, ForeignKey, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, TIMESTAMP

from elfant.db.base import Base


class User(Base):
    __tablename__ = "users"

    user_id = Column(String, primary_key=True)
    username = Column(String, nullable=False)
    display_name = Column(String, nullable=False)
    avatar = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class League(Base):
    __tablename__ = "leagues"

    league_id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    season = Column(String, nullable=False)
    season_type = Column(String)
    sport = Column(String)
    status = Column(String)
    total_rosters = Column(Integer)
    settings = Column(JSONB)
    scoring_settings = Column(JSONB)
    roster_positions = Column(JSONB)
    previous_league_id = Column(String)
    draft_id = Column(String)
    avatar = Column(String)
    league_metadata = Column(JSONB)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Roster(Base):
    __tablename__ = "rosters"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    roster_id = Column(Integer, nullable=False)
    league_id = Column(String, ForeignKey("leagues.league_id"), nullable=False)
    owner_id = Column(String, ForeignKey("users.user_id"), index=True)
    settings = Column(JSONB)
    starters = Column(JSONB)
    players = Column(JSONB)
    reserve = Column(JSONB)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("league_id", "roster_id", name="uq_roster_league"),
    )


class LeagueUser(Base):
    __tablename__ = "league_users"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    league_id = Column(String, ForeignKey("leagues.league_id"), nullable=False)
    user_id = Column(String, ForeignKey("users.user_id"), nullable=False)
    user_metadata = Column("metadata", JSONB)
    is_owner = Column(Boolean, default=False)

    __table_args__ = (
        UniqueConstraint("league_id", "user_id", name="uq_league_user"),
    )


class Player(Base):
    __tablename__ = "players"

    player_id = Column(String, primary_key=True)
    gsis_id = Column(String, nullable=True)
    first_name = Column(String)
    last_name = Column(String)
    team = Column(String)
    position = Column(String)
    fantasy_positions = Column(JSONB)
    status = Column(String)
    height = Column(String)
    weight = Column(String)
    age = Column(Integer)
    number = Column(Integer)
    college = Column(String)
    years_exp = Column(Integer)
    injury_status = Column(String)
    injury_start_date = Column(String)
    sportradar_id = Column(String)
    rotowire_id = Column(Integer)
    rotoworld_id = Column(Integer)
    espn_id = Column(String)
    yahoo_id = Column(String)
    fantasy_data_id = Column(Integer)
    stats_id = Column(String)
    hashtag = Column(String)
    depth_chart_position = Column(String)
    depth_chart_order = Column(Integer)
    search_rank = Column(Integer)
    search_full_name = Column(String)
    search_first_name = Column(String)
    search_last_name = Column(String)
    practice_participation = Column(String)
    news_updated = Column(BigInteger)
    birth_country = Column(String)
    birth_city = Column(String)
    birth_state = Column(String)
    rookie_year = Column(Integer)
    injury_notes = Column(String)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Draft(Base):
    __tablename__ = "drafts"

    draft_id = Column(String, primary_key=True)
    league_id = Column(String, ForeignKey("leagues.league_id"), nullable=False)
    type = Column(String)
    status = Column(String)
    start_time = Column(BigInteger)
    sport = Column(String)
    settings = Column(JSONB)
    season = Column(String)
    season_type = Column(String)
    draft_metadata = Column("metadata", JSONB)
    draft_order = Column(JSONB)
    slot_to_roster_id = Column(JSONB)
    created = Column(BigInteger)


class DraftPick(Base):
    __tablename__ = "draft_picks"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    draft_id = Column(String, ForeignKey("drafts.draft_id"), nullable=False)
    pick_no = Column(Integer, nullable=False)
    round = Column(Integer, nullable=False)
    roster_id = Column(Integer)
    draft_slot = Column(Integer)
    player_id = Column(String)
    picked_by = Column(String)
    is_keeper = Column(Boolean)
    pick_metadata = Column("metadata", JSONB)

    __table_args__ = (
        UniqueConstraint("draft_id", "pick_no", name="uq_draft_pick"),
    )


class Matchup(Base):
    __tablename__ = "matchups"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    league_id = Column(String, ForeignKey("leagues.league_id"), nullable=False)
    week = Column(Integer, nullable=False)
    roster_id = Column(Integer, nullable=False)
    matchup_id = Column(Integer)
    points = Column(Float)
    custom_points = Column(Float)
    starters = Column(JSONB)
    players = Column(JSONB)
    starters_points = Column(JSONB)
    players_points = Column(JSONB)

    __table_args__ = (
        UniqueConstraint("league_id", "week", "roster_id", name="uq_matchup"),
    )


class Transaction(Base):
    __tablename__ = "transactions"

    transaction_id = Column(String, primary_key=True)
    league_id = Column(String, ForeignKey("leagues.league_id"), nullable=False)
    type = Column(String)
    status = Column(String)
    status_updated = Column(BigInteger)
    settings = Column(JSONB)
    roster_ids = Column(JSONB)
    txn_metadata = Column("metadata", JSONB)
    leg = Column(Integer)
    drops = Column(JSONB)
    draft_picks = Column(JSONB)
    creator = Column(String)
    created = Column(BigInteger)
    consenter_ids = Column(JSONB)
    adds = Column(JSONB)
    waiver_budget = Column(JSONB)


class TradedPick(Base):
    __tablename__ = "traded_picks"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    league_id = Column(String, ForeignKey("leagues.league_id"), nullable=False)
    season = Column(String, nullable=False)
    round = Column(Integer, nullable=False)
    roster_id = Column(Integer, nullable=False)
    previous_owner_id = Column(Integer)
    owner_id = Column(Integer, nullable=False)

    __table_args__ = (
        UniqueConstraint(
            "league_id", "season", "round", "roster_id",
            name="uq_traded_pick",
        ),
    )


class PlayoffBracket(Base):
    __tablename__ = "playoff_brackets"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    league_id = Column(String, ForeignKey("leagues.league_id"), nullable=False)
    bracket_type = Column(String, nullable=False)  # "winners" or "losers"
    round = Column(Integer, nullable=False)
    match_id = Column(Integer, nullable=False)
    team_1 = Column(Integer)
    team_2 = Column(Integer)
    team_1_from = Column(JSONB)
    team_2_from = Column(JSONB)
    winner = Column(Integer)
    loser = Column(Integer)
    position = Column(Integer)

    __table_args__ = (
        UniqueConstraint("league_id", "bracket_type", "match_id", name="uq_bracket_match"),
    )


class NflState(Base):
    __tablename__ = "nfl_state"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    week = Column(Integer)
    season = Column(String)
    season_type = Column(String)
    season_start_date = Column(String)
    previous_season = Column(String)
    leg = Column(Integer)
    league_season = Column(String)
    league_create_season = Column(String)
    display_week = Column(Integer)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PlayerWeeklyStat(Base):
    __tablename__ = "player_weekly_stats"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    player_id = Column(String, ForeignKey("players.player_id"), nullable=False, index=True)
    season = Column(Integer, nullable=False)
    week = Column(Integer, nullable=False)
    season_type = Column(String)

    completions = Column(Integer)
    attempts = Column(Integer)
    passing_yards = Column(Integer)
    passing_tds = Column(Integer)
    passing_interceptions = Column(Integer)
    passing_2pt_conversions = Column(Integer)
    sacks_suffered = Column(Integer)

    carries = Column(Integer)
    rushing_yards = Column(Integer)
    rushing_tds = Column(Integer)
    rushing_2pt_conversions = Column(Integer)
    rushing_fumbles = Column(Integer)
    rushing_fumbles_lost = Column(Integer)

    receptions = Column(Integer)
    targets = Column(Integer)
    receiving_yards = Column(Integer)
    receiving_tds = Column(Integer)
    receiving_2pt_conversions = Column(Integer)
    receiving_fumbles = Column(Integer)
    receiving_fumbles_lost = Column(Integer)

    fumbles = Column(Integer)
    fumbles_lost = Column(Integer)
    fumbles_own_recovery = Column(Integer)
    special_teams_tds = Column(Integer)
    kickoff_return_yards = Column(Integer)
    kickoff_returns = Column(Integer)
    punt_return_yards = Column(Integer)
    punt_returns = Column(Integer)

    fg_made = Column(Integer)
    fg_att = Column(Integer)
    fg_made_0_19 = Column(Integer)
    fg_made_20_29 = Column(Integer)
    fg_made_30_39 = Column(Integer)
    fg_made_40_49 = Column(Integer)
    fg_made_50_59 = Column(Integer)
    fg_made_60_ = Column(Integer)
    pat_made = Column(Integer)
    pat_att = Column(Integer)

    def_tackles_solo = Column(Integer)
    def_tackles_with_assist = Column(Integer)
    def_tackles_for_loss = Column(Integer)
    def_sacks = Column(Float)
    def_sack_yards = Column(Float)
    def_interceptions = Column(Integer)
    def_interception_yards = Column(Integer)
    def_pass_defended = Column(Integer)
    def_fumbles_forced = Column(Integer)
    def_fumbles = Column(Integer)
    def_qb_hits = Column(Integer)
    def_tds = Column(Integer)
    def_safeties = Column(Integer)

    fg_missed = Column(Integer)
    pat_missed = Column(Integer)
    fg_blocked = Column(Integer)
    pat_blocked = Column(Integer)
    punt_blocked = Column(Integer)
    kicks_blocked = Column(Integer)
    fumble_recovery_opp = Column(Integer)
    fumble_recovery_tds = Column(Integer)
    fg_yds_bonus = Column(Integer)
    def_4_and_stop = Column(Integer)
    def_3_and_out = Column(Integer)

    offense_snaps = Column(Integer)
    defense_snaps = Column(Integer)
    st_snaps = Column(Integer)
    offense_pct = Column(Float)
    defense_pct = Column(Float)
    st_pct = Column(Float)
    def_time_of_possession = Column(Integer)
    def_plays = Column(Integer)
    total_plays = Column(Integer)

    target_share = Column(Float)
    air_yards = Column(Integer)
    racr = Column(Float)
    wopr = Column(Float)
    passing_air_yards = Column(Integer)
    passing_epa = Column(Float)
    receiving_epa = Column(Float)
    rushing_epa = Column(Float)

    pts_allowed = Column(Float)
    yds_allowed = Column(Integer)

    team = Column(String)
    opponent = Column(String)

    __table_args__ = (
        UniqueConstraint("player_id", "season", "week", "season_type", name="uq_player_weekly"),
    )
