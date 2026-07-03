import os
from pathlib import Path

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from elfant.db.base import get_session
from elfant.db.models import (
    League, Roster, LeagueUser, User, Player, Draft, DraftPick, Matchup,
    Transaction, PlayoffBracket, NflState, PlayerWeeklyStat,
)
from elfant.scoring import fantasy_points
from elfant.sync.sync import (
    sync_league_all, sync_league, sync_rosters, sync_league_users,
    sync_playoffs,
)

app = FastAPI(title="elfant")

FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")


SLEEPER_CDN = "https://sleepercdn.com"
PLAYER_IMG = f"{SLEEPER_CDN}/content/nfl/players"
TEAM_LOGO = f"{SLEEPER_CDN}/images/team_logos/nfl"
AVATAR_THUMB = f"{SLEEPER_CDN}/avatars/thumbs"


def _resolve_players(player_ids, session, players_points=None, positions=None):
    if not player_ids:
        return []
    result = []
    pts_map = players_points or {}
    for i, pid in enumerate(player_ids):
        is_def = pid and not pid.isdigit()
        player = session.get(Player, pid) if pid and pid.isdigit() else None
        position = positions[i] if positions and i < len(positions) else (player.position if player else ("DEF" if is_def else ""))
        team_abbr = player.team if player else (pid if is_def else None)
        result.append({
            "player_id": pid,
            "name": f"{player.first_name} {player.last_name}".strip() if player else pid,
            "position": position,
            "team": team_abbr or "",
            "points": pts_map.get(pid, 0),
            "player_img": f"{PLAYER_IMG}/{pid}.jpg" if pid and pid.isdigit() else None,
            "team_logo": f"{TEAM_LOGO}/{team_abbr.lower()}.png" if team_abbr else None,
        })
    return result


def _enrich_rosters(rosters_list, session):
    result = []
    for r in rosters_list:
        s = r.settings or {}
        owner = session.get(User, r.owner_id) if r.owner_id else None
        lu = (
            session.query(LeagueUser)
            .filter_by(league_id=r.league_id, user_id=r.owner_id)
            .first()
        ) if r.owner_id else None
        team_name = None
        if lu and lu.user_metadata:
            team_name = lu.user_metadata.get("team_name")
        result.append({
            "roster_id": r.roster_id,
            "owner_id": r.owner_id,
            "owner_display": owner.display_name if owner else None,
            "owner_avatar": f"{AVATAR_THUMB}/{owner.avatar}" if owner and owner.avatar else None,
            "team_name": team_name if team_name else (f"Team {owner.display_name}" if owner else f"Team {r.roster_id}"),
            "wins": s.get("wins", 0),
            "losses": s.get("losses", 0),
            "ties": s.get("ties", 0),
            "fpts": (s.get("fpts", 0) or 0) + (s.get("fpts_decimal", 0) or 0) / 100,
            "fpts_against": (s.get("fpts_against", 0) or 0) + (s.get("fpts_against_decimal", 0) or 0) / 100,
            "waiver_position": s.get("waiver_position"),
            "waiver_budget_used": s.get("waiver_budget_used"),
            "total_moves": s.get("total_moves", 0),
        })
    result.sort(key=lambda x: (-x["wins"], -x["fpts"]))
    return result


def _get_drafts(league_id, session):
    drafts = session.query(Draft).filter_by(league_id=league_id).order_by(Draft.season.desc()).all()
    result = []
    for d in drafts:
        picks = (
            session.query(DraftPick)
            .filter_by(draft_id=d.draft_id)
            .order_by(DraftPick.pick_no)
            .all()
        )
        pick_list = []
        for p in picks:
            player = session.get(Player, p.player_id) if p.player_id else None
            meta = p.pick_metadata or {}
            draft_team = meta.get("team") or meta.get("team_abbr") or (player.team if player else None)
            pick_list.append({
                "pick_no": p.pick_no,
                "round": p.round,
                "roster_id": p.roster_id,
                "player_id": p.player_id,
                "first_name": meta.get("first_name") or (player.first_name if player else None),
                "last_name": meta.get("last_name") or (player.last_name if player else None),
                "team": draft_team,
                "position": meta.get("position") or (player.position if player else None),
                "team_logo": f"{TEAM_LOGO}/{draft_team.lower()}.png" if draft_team else None,
            })
        result.append({
            "draft_id": d.draft_id,
            "season": d.season,
            "type": d.type,
            "status": d.status,
            "picks": pick_list,
        })
    return result


def _get_full_league_chain(league_id, session):
    backward = []
    lg = session.get(League, league_id)
    while lg:
        backward.append(lg)
        lg = session.get(League, lg.previous_league_id) if lg.previous_league_id else None
    if not backward:
        return []

    forward = []
    lg = backward[0]
    while True:
        next_lg = session.query(League).filter(
            League.previous_league_id == lg.league_id
        ).first()
        if not next_lg:
            break
        forward.append(next_lg)
        lg = next_lg

    return list(reversed(backward)) + forward


# ---- API Routes ----

@app.get("/api/league/{league_id}")
async def api_league(league_id: str):
    with get_session() as session:
        existing = session.get(League, league_id)
        has_rosters = session.query(Roster).filter_by(league_id=league_id).first() is not None

    if not existing:
        sync_league_all(league_id)
    elif not has_rosters:
        sync_league(league_id)
        sync_league_users(league_id)
        sync_rosters(league_id)

    with get_session() as session:
        league = session.get(League, league_id)
        if not league:
            raise HTTPException(404, "League not found")

        rosters = _enrich_rosters(
            session.query(Roster).filter_by(league_id=league_id).all(), session
        )
        drafts = _get_drafts(league_id, session)

        chain = _get_full_league_chain(league_id, session)
        idx = next((i for i, lg in enumerate(chain) if lg.league_id == league_id), -1)

        def _to_ref(lg):
            return {"league_id": lg.league_id, "name": lg.name, "season": lg.season}

        max_week = 0
        latest = (
            session.query(Matchup.week)
            .filter_by(league_id=league_id)
            .order_by(Matchup.week.desc())
            .first()
        )
        if latest:
            max_week = latest[0]

    return {
        "league": {"league_id": league.league_id, "name": league.name, "season": league.season, "status": league.status, "total_rosters": league.total_rosters},
        "rosters": rosters,
        "previous": _to_ref(chain[idx - 1]) if idx > 0 else None,
        "next": _to_ref(chain[idx + 1]) if idx < len(chain) - 1 else None,
        "drafts": drafts,
        "max_week": max_week,
    }


@app.get("/api/league/{league_id}/chain")
async def api_league_chain(league_id: str):
    with get_session() as session:
        existing = session.get(League, league_id)
        if not existing:
            sync_league(league_id)

    with get_session() as session:
        chain = _get_full_league_chain(league_id, session)
        if not chain:
            raise HTTPException(404, "League not found")

        seasons = [
            {
                "league_id": lg.league_id,
                "name": lg.name,
                "season": lg.season,
                "status": lg.status,
                "total_rosters": lg.total_rosters,
            }
            for lg in chain
        ]

        return {
            "league_id": league_id,
            "group_id": chain[-1].league_id,
            "name": chain[-1].name,
            "seasons": seasons,
        }


@app.get("/api/league/{league_id}/overview")
async def api_league_overview(league_id: str):
    with get_session() as session:
        existing = session.get(League, league_id)
        if not existing:
            sync_league(league_id)

    with get_session() as session:
        chain = _get_full_league_chain(league_id, session)
        if not chain:
            raise HTTPException(404, "League not found")

        group_id = chain[-1].league_id
        name = chain[-1].name

        def _resolve_roster(league_id, roster_id):
            if roster_id is None:
                return None
            roster = session.query(Roster).filter_by(league_id=league_id, roster_id=roster_id).first()
            if not roster:
                return None
            owner = session.get(User, roster.owner_id) if roster.owner_id else None
            lu = session.query(LeagueUser).filter_by(
                league_id=league_id, user_id=roster.owner_id
            ).first() if roster.owner_id else None
            team_name = None
            if lu and lu.user_metadata:
                team_name = lu.user_metadata.get("team_name")
            display = team_name or (f"Team {owner.display_name}" if owner else None)
            return {
                "display": display,
                "owner_id": roster.owner_id,
                "owner_name": owner.display_name if owner else None,
                "avatar": f"{AVATAR_THUMB}/{owner.avatar}" if owner and owner.avatar else None,
            }

        seasons = []
        for lg in chain:
            s = {
                "league_id": lg.league_id,
                "name": lg.name,
                "season": lg.season,
                "status": lg.status,
                "total_rosters": lg.total_rosters,
                "champion": None,
                "champion_owner": None,
                "champion_avatar": None,
                "runner_up": None,
                "runner_up_owner": None,
                "trash_king": None,
                "trash_king_owner": None,
                "trash_king_avatar": None,
                "third_place": None,
                "third_place_owner": None,
            }

            existing_bracket = session.query(PlayoffBracket).filter_by(
                league_id=lg.league_id, bracket_type="winners"
            ).first()
            if not existing_bracket and lg.status == "complete":
                sync_playoffs(lg.league_id)

            champ_match = session.query(PlayoffBracket).filter_by(
                league_id=lg.league_id, bracket_type="winners", position=1
            ).first()
            if champ_match:
                for role, roster_id in [("champion", champ_match.winner), ("runner_up", champ_match.loser)]:
                    info = _resolve_roster(lg.league_id, roster_id)
                    if not info:
                        continue
                    if role == "champion":
                        s["champion"] = info["display"]
                        s["champion_owner"] = info["owner_name"]
                        s["champion_avatar"] = info["avatar"]
                    else:
                        s["runner_up"] = info["display"]
                        s["runner_up_owner"] = info["owner_name"]

            third_match = session.query(PlayoffBracket).filter_by(
                league_id=lg.league_id, bracket_type="winners", position=3
            ).first()
            if third_match:
                info = _resolve_roster(lg.league_id, third_match.winner)
                if info:
                    s["third_place"] = info["display"]
                    s["third_place_owner"] = info["owner_name"]

            loser_roster_ids = set()
            for b in session.query(PlayoffBracket).filter_by(
                league_id=lg.league_id, bracket_type="losers"
            ).all():
                if b.team_1: loser_roster_ids.add(b.team_1)
                if b.team_2: loser_roster_ids.add(b.team_2)

            if loser_roster_ids and lg.settings:
                playoff_start = int(lg.settings.get("playoff_week_start", 15))
                max_week_row = session.query(Matchup.week).filter_by(
                    league_id=lg.league_id
                ).order_by(Matchup.week.desc()).first()
                max_week = max_week_row[0] if max_week_row else 0

                results = {rid: {"wins": 0, "losses": 0, "games": 0} for rid in loser_roster_ids}

                for w in range(playoff_start, max_week + 1):
                    matchups = session.query(Matchup).filter_by(
                        league_id=lg.league_id, week=w
                    ).all()
                    by_mid = {}
                    for m in matchups:
                        mid = m.matchup_id if m.matchup_id else f"bye_{m.roster_id}"
                        by_mid.setdefault(mid, []).append(m)
                    for group in by_mid.values():
                        if len(group) < 2:
                            continue
                        a, b = group[0], group[1]
                        for rid in [a.roster_id, b.roster_id]:
                            if rid in results:
                                results[rid]["games"] += 1
                                a_pts = a.points or 0
                                b_pts = b.points or 0
                                if (rid == a.roster_id and a_pts > b_pts) or (rid == b.roster_id and b_pts > a_pts):
                                    results[rid]["wins"] += 1
                                else:
                                    results[rid]["losses"] += 1

                zero_win = [rid for rid, r in results.items() if r["games"] > 0 and r["wins"] == 0]
                if zero_win:
                    trash_rid = max(zero_win, key=lambda rid: results[rid]["losses"])
                    info = _resolve_roster(lg.league_id, trash_rid)
                    if info:
                        s["trash_king"] = info["display"]
                        s["trash_king_owner"] = info["owner_name"]
                        s["trash_king_avatar"] = info["avatar"]

            seasons.append(s)

        total_teams = max((sg["total_rosters"] for sg in seasons), default=0)

        medals_map = {}
        for sg in seasons:
            for medal, field_owner, field_avatar in [
                ("gold", "champion_owner", "champion_avatar"),
                ("silver", "runner_up_owner", "runner_up_avatar"),
                ("bronze", "third_place_owner", "third_place_avatar"),
            ]:
                owner_name = sg.get(field_owner)
                if not owner_name:
                    continue
                if owner_name not in medals_map:
                    medals_map[owner_name] = {"owner_name": owner_name, "avatar": sg.get(field_avatar), "gold": 0, "silver": 0, "bronze": 0}
                medals_map[owner_name][medal] += 1

        all_time_medals = sorted(medals_map.values(), key=lambda m: (-m["gold"], -m["silver"], -m["bronze"]))

        season_years = [sg["season"] for sg in seasons]

        owner_data = {}
        for lg in chain:
            season = lg.season
            rosters_db = session.query(Roster).filter_by(league_id=lg.league_id).all()
            for r in rosters_db:
                if not r.owner_id:
                    continue
                owner = session.get(User, r.owner_id)
                lu = session.query(LeagueUser).filter_by(
                    league_id=lg.league_id, user_id=r.owner_id
                ).first() if r.owner_id else None
                team_name = None
                if lu and lu.user_metadata:
                    team_name = lu.user_metadata.get("team_name")

                if r.owner_id not in owner_data:
                    owner_data[r.owner_id] = {
                        "owner_id": r.owner_id,
                        "display_name": owner.display_name if owner else None,
                        "avatar": f"{AVATAR_THUMB}/{owner.avatar}" if owner and owner.avatar else None,
                        "seasons": {},
                    }
                owner_data[r.owner_id]["seasons"][season] = {
                    "team_name": team_name or (f"Team {owner.display_name}" if owner else f"Roster {r.roster_id}"),
                    "present": True,
                }

        for od in owner_data.values():
            for sy in season_years:
                if sy not in od["seasons"]:
                    od["seasons"][sy] = {"team_name": None, "present": False}

        first_season = season_years[0]
        last_season = season_years[-1]

        old_guard = []
        newcomers = []
        previously_left = []

        for od in owner_data.values():
            participated_all = all(od["seasons"][sy]["present"] for sy in season_years)
            in_last = od["seasons"][last_season]["present"]
            in_first = od["seasons"][first_season]["present"]

            if participated_all:
                od["group"] = "old_guard"
                old_guard.append(od)
            elif in_last and not in_first:
                od["group"] = "newcomer"
                newcomers.append(od)
            elif not in_last and any(od["seasons"][sy]["present"] for sy in season_years):
                od["group"] = "previously_left"
                previously_left.append(od)

        for group in [old_guard, newcomers, previously_left]:
            group.sort(key=lambda x: min(int(sy) for sy, s in x["seasons"].items() if s["present"]))

        return {
            "group_id": group_id,
            "name": name,
            "seasons": seasons,
            "total_seasons": len(seasons),
            "total_teams": total_teams,
            "participants": {
                "seasons": season_years,
                "old_guard": old_guard,
                "newcomers": newcomers,
                "previously_left": previously_left,
            },
            "all_time_medals": all_time_medals,
        }


@app.post("/api/league/{league_id}/refresh")
async def api_league_refresh(league_id: str):
    sync_league_all(league_id)
    # Invalidate cache for all seasons of this league
    keys_to_remove = [k for k in _player_stats_cache if k[0] == league_id]
    for k in keys_to_remove:
        _player_stats_cache.pop(k, None)
        _player_stats_cache_time.pop(k, None)
    return {"status": "ok"}


@app.get("/api/league/{league_id}/matchups/{week}")
async def api_league_matchups(league_id: str, week: int):
    with get_session() as session:
        rows = (
            session.query(Matchup)
            .filter_by(league_id=league_id, week=week)
            .order_by(Matchup.matchup_id)
            .all()
        )
        if not rows:
            return []

        owners = {}
        for r in session.query(Roster).filter_by(league_id=league_id).all():
            owner = session.get(User, r.owner_id) if r.owner_id else None
            lu = session.query(LeagueUser).filter_by(league_id=league_id, user_id=r.owner_id).first() if r.owner_id else None
            team_name = None
            if lu and lu.user_metadata:
                team_name = lu.user_metadata.get("team_name")
            owners[r.roster_id] = {
                "name": team_name if team_name else (f"Team {owner.display_name}" if owner else f"Roster {r.roster_id}"),
                "avatar": f"{AVATAR_THUMB}/{owner.avatar}" if owner and owner.avatar else None,
            }

        # Get league roster positions for starter position mapping
        league = session.get(League, league_id)
        roster_positions = league.roster_positions if league and league.roster_positions else []
        starting_positions = [p for p in roster_positions if p != "BN"]

        matchup_map = {}
        for m in rows:
            mid = m.matchup_id if m.matchup_id else f"bye_{m.roster_id}"
            matchup_map.setdefault(mid, []).append(m)

        # Compute cumulative standings through the requested week
        cum_wins: dict[int, int] = {}
        cum_losses: dict[int, int] = {}
        cum_fpts: dict[int, float] = {}
        all_matchups = session.query(Matchup).filter(
            Matchup.league_id == league_id,
            Matchup.week <= week,
        ).all()

        # Group by (week, matchup_id) to find which rosters faced each other
        by_group: dict[tuple[int, str], list] = {}
        for m in all_matchups:
            gid = m.matchup_id or f"bye_{m.roster_id}"
            by_group.setdefault((m.week, str(gid)), []).append(m)

        for group in by_group.values():
            if len(group) < 2:
                continue
            a, b = group[0], group[1]
            a_pts = a.points or 0
            b_pts = b.points or 0
            cum_fpts[a.roster_id] = cum_fpts.get(a.roster_id, 0) + a_pts
            cum_fpts[b.roster_id] = cum_fpts.get(b.roster_id, 0) + b_pts
            if a_pts > b_pts:
                cum_wins[a.roster_id] = cum_wins.get(a.roster_id, 0) + 1
            elif b_pts > a_pts:
                cum_wins[b.roster_id] = cum_wins.get(b.roster_id, 0) + 1

        all_rids = set(list(cum_wins.keys()) + list(cum_fpts.keys()))
        for rid in all_rids:
            total_games = sum(1 for g in by_group.values() if len(g) >= 2 and any(m.roster_id == rid for m in g))
            cum_losses[rid] = total_games - cum_wins.get(rid, 0)

        sorted_rids = sorted(all_rids, key=lambda rid: (-cum_wins.get(rid, 0), -cum_fpts.get(rid, 0)))
        rank_map = {rid: i + 1 for i, rid in enumerate(sorted_rids)}
        rec_map = {rid: f"{cum_wins.get(rid, 0)}-{cum_losses.get(rid, 0)}" for rid in all_rids}

        matchups = []
        for mid, teams in matchup_map.items():
            if len(teams) < 2:
                continue
            t1, t2 = teams[0], teams[1]
            t1_starters = t1.starters or []
            t1_bench = [p for p in (t1.players or []) if p not in t1_starters] if t1.players else []
            t2_starters = t2.starters or []
            t2_bench = [p for p in (t2.players or []) if p not in t2_starters] if t2.players else []
            t1_pts_map = t1.players_points or {}
            t2_pts_map = t2.players_points or {}
            o1 = owners.get(t1.roster_id, {})
            o2 = owners.get(t2.roster_id, {})
            t1_result = "win" if (t1.points or 0) > (t2.points or 0) else ("loss" if (t1.points or 0) < (t2.points or 0) else "tie")
            t2_result = "win" if (t2.points or 0) > (t1.points or 0) else ("loss" if (t2.points or 0) < (t1.points or 0) else "tie")
            # Map starter positions: for FLEX, use the player's actual position
            def starter_positions(starters_list, pts_map):
                if not starting_positions:
                    return None
                pos = []
                for i, pid in enumerate(starters_list):
                    if i < len(starting_positions) and starting_positions[i] == "FLEX":
                        player = session.get(Player, pid) if pid and pid.isdigit() else None
                        pos.append(player.position if player else "FLEX")
                    elif i < len(starting_positions):
                        pos.append(starting_positions[i])
                    else:
                        pos.append("")
                return pos

            t1_spos = starter_positions(t1_starters, t1_pts_map)
            t2_spos = starter_positions(t2_starters, t2_pts_map)

            matchups.append({
                "matchup_id": mid,
                "team_name": o1.get("name", f"Roster {t1.roster_id}"),
                "team_avatar": o1.get("avatar"),
                "points": t1.points or 0,
                "result": t1_result,
                "record": rec_map.get(t1.roster_id, ""),
                "rank": rank_map.get(t1.roster_id, 0),
                "starters": _resolve_players(t1_starters, session, t1_pts_map, t1_spos),
                "bench": _resolve_players(t1_bench, session, t1_pts_map),
                "opp_name": o2.get("name", f"Roster {t2.roster_id}"),
                "opp_avatar": o2.get("avatar"),
                "opp_points": t2.points or 0,
                "opp_result": t2_result,
                "opp_record": rec_map.get(t2.roster_id, ""),
                "opp_rank": rank_map.get(t2.roster_id, 0),
                "opp_starters": _resolve_players(t2_starters, session, t2_pts_map, t2_spos),
                "opp_bench": _resolve_players(t2_bench, session, t2_pts_map),
            })

        return matchups


@app.get("/api/league/{league_id}/playoffs")
async def api_playoffs(league_id: str):
    sync_playoffs(league_id)

    with get_session() as session:
        rows = (
            session.query(PlayoffBracket)
            .filter_by(league_id=league_id)
            .order_by(PlayoffBracket.bracket_type, PlayoffBracket.match_id)
            .all()
        )

        league = session.get(League, league_id)
        playoff_week_start = (league.settings or {}).get("playoff_week_start", 15) if league else 15

        # Build roster -> owner info map
        owners = {}
        for r in session.query(Roster).filter_by(league_id=league_id).all():
            owner = session.get(User, r.owner_id) if r.owner_id else None
            lu = session.query(LeagueUser).filter_by(league_id=league_id, user_id=r.owner_id).first() if r.owner_id else None
            team_name = None
            if lu and lu.user_metadata:
                team_name = lu.user_metadata.get("team_name")
            owners[r.roster_id] = {
                "name": team_name if team_name else (f"Team {owner.display_name}" if owner else f"Roster {r.roster_id}"),
                "avatar": f"{AVATAR_THUMB}/{owner.avatar}" if owner and owner.avatar else None,
                "owner": owner.display_name if owner else None,
            }

        def resolve_team(roster_id) -> dict:
            return owners.get(roster_id, {"name": f"Roster {roster_id}", "avatar": None, "owner": None})

        # Pre-fetch all matchup scores keyed by (week, roster_id)
        scores: dict = {}
        max_round = max((b.round for b in rows), default=0)
        for rnd in range(1, max_round + 1):
            week = playoff_week_start + rnd - 1
            matchups_data = session.query(Matchup).filter_by(league_id=league_id, week=week).all()
            for md in matchups_data:
                scores[(week, md.roster_id)] = md.points or 0

        def get_week_for_round(rnd: int) -> int:
            return playoff_week_start + rnd - 1

        def get_score(rid: int | None, rnd: int) -> float | None:
            if rid is None:
                return None
            week = get_week_for_round(rnd)
            return scores.get((week, rid))

        result = {"winners": [], "losers": []}
        for b in rows:
            t1 = resolve_team(b.team_1) if b.team_1 else None
            t2 = resolve_team(b.team_2) if b.team_2 else None
            w = resolve_team(b.winner) if b.winner else None
            l = resolve_team(b.loser) if b.loser else None
            entry = {
                "round": b.round,
                "match_id": b.match_id,
                "team_1": b.team_1,
                "team_1_name": t1["name"] if t1 else None,
                "team_1_avatar": t1["avatar"] if t1 else None,
                "team_1_owner": t1["owner"] if t1 else None,
                "team_1_score": get_score(b.team_1, b.round),
                "team_2": b.team_2,
                "team_2_name": t2["name"] if t2 else None,
                "team_2_avatar": t2["avatar"] if t2 else None,
                "team_2_owner": t2["owner"] if t2 else None,
                "team_2_score": get_score(b.team_2, b.round),
                "team_1_from": b.team_1_from,
                "team_2_from": b.team_2_from,
                "winner": b.winner,
                "winner_name": w["name"] if w else None,
                "winner_score": get_score(b.winner, b.round),
                "loser": b.loser,
                "loser_name": l["name"] if l else None,
                "loser_score": get_score(b.loser, b.round),
                "position": b.position,
            }
            result[b.bracket_type].append(entry)

        return result


@app.get("/api/league/{league_id}/rankings")
async def api_rankings(league_id: str, mode: str = "standard"):
    with get_session() as session:
        league = session.get(League, league_id)
        if not league:
            raise HTTPException(404, "League not found")

        rosters_raw = session.query(Roster).filter_by(league_id=league_id).all()
        owners = {}
        for r in rosters_raw:
            owner = session.get(User, r.owner_id) if r.owner_id else None
            lu = session.query(LeagueUser).filter_by(league_id=league_id, user_id=r.owner_id).first() if r.owner_id else None
            team_name = None
            if lu and lu.user_metadata:
                team_name = lu.user_metadata.get("team_name")
            owners[r.roster_id] = {
                "name": team_name if team_name else (f"Team {owner.display_name}" if owner else f"Roster {r.roster_id}"),
                "owner": owner.display_name if owner else None,
                "avatar": f"{AVATAR_THUMB}/{owner.avatar}" if owner and owner.avatar else None,
            }

        playoff_start = (league.settings or {}).get("playoff_week_start", 99) if league else 99
        max_week = 0
        latest = session.query(Matchup.week).filter_by(league_id=league_id).order_by(Matchup.week.desc()).first()
        if latest:
            max_week = min(latest[0], playoff_start - 1)

        if max_week < 1:
            return {"weeks": [], "rosters": []}

        roster_ids = sorted([r.roster_id for r in rosters_raw])
        cum_wins = {rid: 0 for rid in roster_ids}
        cum_median_wins = {rid: 0 for rid in roster_ids}
        cum_all_play_wins = {rid: 0 for rid in roster_ids}
        cum_fpts = {rid: 0.0 for rid in roster_ids}
        cum_fpa = {rid: 0.0 for rid in roster_ids}
        weekly_pts = {rid: [] for rid in roster_ids}
        cum_median_fpts = 0.0
        cum_efficiency = {rid: 0.0 for rid in roster_ids}
        cum_optimal_wins = {rid: 0 for rid in roster_ids}
        cum_optimal_fpts = {rid: 0.0 for rid in roster_ids}
        rosters_data = {rid: {"roster_id": rid, "name": owners.get(rid, {}).get("name", f"Roster {rid}"), "owner": owners.get(rid, {}).get("owner"), "avatar": owners.get(rid, {}).get("avatar"), "rankings": [], "pf_diffs": [], "median_wins": 0, "total_weeks": 0, "all_play_wins": 0, "avg_efficiency": 0, "optimal_wins": 0} for rid in roster_ids}

        for w in range(1, max_week + 1):
            matchups = session.query(Matchup).filter_by(league_id=league_id, week=w).all()
            md = {m.roster_id: m for m in matchups}

            seen = set()
            pa = {rid: 0.0 for rid in roster_ids}
            for m in matchups:
                if m.matchup_id in seen or m.matchup_id is None:
                    continue
                seen.add(m.matchup_id)
                opp = [x for x in matchups if x.matchup_id == m.matchup_id and x.roster_id != m.roster_id]
                if opp:
                    t1, t2 = m, opp[0]
                    p1 = t1.points or 0
                    p2 = t2.points or 0
                    pa[t1.roster_id] = p2
                    pa[t2.roster_id] = p1
                    if p1 > p2:
                        cum_wins[t1.roster_id] = cum_wins.get(t1.roster_id, 0) + 1
                    elif p2 > p1:
                        cum_wins[t2.roster_id] = cum_wins.get(t2.roster_id, 0) + 1
                    else:
                        cum_wins[t1.roster_id] = cum_wins.get(t1.roster_id, 0) + 0.5
                        cum_wins[t2.roster_id] = cum_wins.get(t2.roster_id, 0) + 0.5

            week_optimal_map = {}
            week_pts = []
            for rid in roster_ids:
                m = md.get(rid)
                pts = m.points or 0 if m else 0
                cum_fpts[rid] += pts
                cum_fpa[rid] += pa.get(rid, 0)
                weekly_pts[rid].append(pts)
                week_pts.append(pts)

                # Efficiency
                if m and m.players_points and m.starters:
                    pp = m.players_points or {}
                    n_starters = len(m.starters)
                    sorted_pts = sorted([v for v in pp.values() if v is not None], reverse=True)
                    optimal = sum(sorted_pts[:n_starters]) if sorted_pts else pts
                else:
                    optimal = pts
                eff = (pts / optimal * 100) if optimal > 0 else 100
                cum_efficiency[rid] += eff
                cum_optimal_fpts[rid] += optimal
                week_optimal_map[rid] = optimal
                if optimal > pa.get(rid, 0):
                    cum_optimal_wins[rid] += 1
                elif optimal == pa.get(rid, 0):
                    cum_optimal_wins[rid] += 0.5

            week_pts.sort()
            n = len(week_pts)
            if n % 2 == 0:
                median = (week_pts[n // 2 - 1] + week_pts[n // 2]) / 2
            else:
                median = week_pts[n // 2]
            cum_median_fpts += median

            # All-play wins for this week
            week_pf_map = {rid: (md.get(rid).points or 0 if md.get(rid) else 0) for rid in roster_ids}
            for rid in roster_ids:
                pts = week_pf_map[rid]
                ap_wins = sum(1 for other_id in roster_ids if other_id != rid and pts > week_pf_map[other_id])
                cum_all_play_wins[rid] += ap_wins

                if pts > median:
                    cum_median_wins[rid] += 1
                elif pts == median:
                    cum_median_wins[rid] += 0.5

            if mode == "median":
                ranked = sorted(roster_ids, key=lambda rid: (-cum_median_wins[rid], -cum_fpts[rid]))
            elif mode == "all_play":
                ranked = sorted(roster_ids, key=lambda rid: (-cum_all_play_wins[rid], -cum_fpts[rid]))
            elif mode == "efficiency":
                ranked = sorted(roster_ids, key=lambda rid: (-cum_optimal_wins[rid], -cum_optimal_fpts[rid]))
            else:
                ranked = sorted(roster_ids, key=lambda rid: (-cum_wins[rid], -cum_fpts[rid]))

            for rank, rid in enumerate(ranked, 1):
                rosters_data[rid]["rankings"].append(rank)
                if mode == "median":
                    diff = round(cum_fpts[rid] - cum_median_fpts, 1)
                elif mode == "all_play":
                    # Show cumulative PF - cumulative median PF for all_play mode
                    diff = round(cum_fpts[rid] - cum_median_fpts, 1)
                elif mode == "efficiency":
                    diff = round(cum_optimal_fpts[rid], 1)
                else:
                    diff = round(cum_fpts[rid] - cum_fpa[rid], 1)
                rosters_data[rid]["pf_diffs"].append(diff)

        for rid in roster_ids:
            rosters_data[rid]["median_wins"] = cum_median_wins[rid]
            rosters_data[rid]["total_weeks"] = max_week
            rosters_data[rid]["all_play_wins"] = cum_all_play_wins[rid]
            rosters_data[rid]["avg_efficiency"] = round(cum_efficiency[rid] / max_week, 1) if max_week else 0
            rosters_data[rid]["optimal_wins"] = cum_optimal_wins[rid]

        return {
            "weeks": list(range(1, max_week + 1)),
            "rosters": [rosters_data[rid] for rid in roster_ids],
        }


@app.get("/api/league/{league_id}/team-stats")
async def api_team_stats(league_id: str):
    with get_session() as session:
        league = session.get(League, league_id)
        if not league:
            raise HTTPException(404, "League not found")

        rosters_raw = session.query(Roster).filter_by(league_id=league_id).all()
        roster_ids = sorted([r.roster_id for r in rosters_raw])

        owners = {}
        for r in rosters_raw:
            owner = session.get(User, r.owner_id) if r.owner_id else None
            lu = session.query(LeagueUser).filter_by(league_id=league_id, user_id=r.owner_id).first() if r.owner_id else None
            team_name = None
            if lu and lu.user_metadata:
                team_name = lu.user_metadata.get("team_name")
            owners[r.roster_id] = {
                "name": team_name if team_name else (f"Team {owner.display_name}" if owner else f"Roster {r.roster_id}"),
                "owner": owner.display_name if owner else None,
                "avatar": f"{AVATAR_THUMB}/{owner.avatar}" if owner and owner.avatar else None,
            }

        playoff_start = (league.settings or {}).get("playoff_week_start", 99) if league else 99
        max_week = 0
        latest = session.query(Matchup.week).filter_by(league_id=league_id).order_by(Matchup.week.desc()).first()
        if latest:
            max_week = min(latest[0], playoff_start - 1)

        if max_week < 1:
            return {"weeks": [], "rosters": []}

        all_stats = {rid: {"roster_id": rid, "name": owners.get(rid, {}).get("name", f"Roster {rid}"), "owner": owners.get(rid, {}).get("owner"), "avatar": owners.get(rid, {}).get("avatar"), "weekly": [], "season_avg": 0, "season_std": 0, "bust_rate": 0, "all_play_wins": 0, "all_play_total": 0, "avg_efficiency": 0} for rid in roster_ids}
        weekly_pf = {rid: [] for rid in roster_ids}
        weekly_efficiency = {rid: [] for rid in roster_ids}

        for w in range(1, max_week + 1):
            matchups = session.query(Matchup).filter_by(league_id=league_id, week=w).all()
            md = {m.roster_id: m for m in matchups}

            seen = set()
            pa = {rid: 0.0 for rid in roster_ids}
            for m in matchups:
                if m.matchup_id in seen or m.matchup_id is None:
                    continue
                seen.add(m.matchup_id)
                opp = [x for x in matchups if x.matchup_id == m.matchup_id and x.roster_id != m.roster_id]
                if opp:
                    pa[m.roster_id] = opp[0].points or 0
                    pa[opp[0].roster_id] = m.points or 0

            week_pf_map = {}
            week_optimal = {}
            week_efficiency = {}
            for rid in roster_ids:
                m = md.get(rid)
                pts = m.points or 0 if m else 0
                weekly_pf[rid].append(pts)
                week_pf_map[rid] = pts

                if m and m.players_points and m.starters:
                    pp = m.players_points or {}
                    n_starters = len(m.starters)
                    sorted_pts = sorted([v for v in pp.values() if v is not None], reverse=True)
                    optimal = sum(sorted_pts[:n_starters]) if sorted_pts else pts
                else:
                    optimal = pts
                efficiency = (pts / optimal * 100) if optimal > 0 else 100
                week_optimal[rid] = optimal
                week_efficiency[rid] = efficiency
                weekly_efficiency[rid].append(efficiency)

            all_play_total = len(roster_ids) - 1
            week_avg = round(sum(week_pf_map.values()) / len(week_pf_map), 1) if week_pf_map else 0
            for rid in roster_ids:
                ap_wins = sum(1 for other_id in roster_ids if other_id != rid and week_pf_map[rid] > week_pf_map[other_id])
                opt = week_optimal[rid]
                opt_win = 1 if opt > pa.get(rid, 0) else (0.5 if opt == pa.get(rid, 0) else 0)
                all_stats[rid]["weekly"].append({
                    "pf": round(week_pf_map[rid], 1),
                    "pa": round(pa.get(rid, 0), 1),
                    "league_avg": week_avg,
                    "all_play_wins": ap_wins,
                    "all_play_total": all_play_total,
                    "optimal": round(opt, 1),
                    "efficiency": round(week_efficiency[rid], 1),
                    "optimal_wins": opt_win,
                })

        for rid in roster_ids:
            pf_vals = weekly_pf[rid]
            n = len(pf_vals)
            avg = sum(pf_vals) / n if n else 0
            variance = sum((x - avg) ** 2 for x in pf_vals) / n if n else 0
            std = variance ** 0.5
            bust_threshold = avg * 0.5
            busts = sum(1 for x in pf_vals if x < bust_threshold)
            bust_rate = busts / n if n else 0
            all_play_wins = sum(s["all_play_wins"] for s in all_stats[rid]["weekly"])
            avg_eff = sum(weekly_efficiency[rid]) / len(weekly_efficiency[rid]) if weekly_efficiency[rid] else 100

            all_stats[rid]["season_avg"] = round(avg, 1)
            all_stats[rid]["season_std"] = round(std, 1)
            all_stats[rid]["bust_rate"] = round(bust_rate, 2)
            all_stats[rid]["all_play_wins"] = all_play_wins
            all_stats[rid]["all_play_total"] = all_play_total * n
            all_stats[rid]["avg_efficiency"] = round(avg_eff, 1)
            all_stats[rid]["optimal_wins"] = sum(s["optimal_wins"] for s in all_stats[rid]["weekly"])

        return {
            "weeks": list(range(1, max_week + 1)),
            "rosters": [all_stats[rid] for rid in roster_ids],
        }


@app.get("/api/league/{league_id}/transactions")
async def api_transactions(league_id: str, leg: int | None = None):
    with get_session() as session:
        league = session.get(League, league_id)
        season = int(league.season) if league else None

        q = session.query(Transaction).filter_by(league_id=league_id)
        if leg:
            q = q.filter_by(leg=leg)
        q = q.order_by(Transaction.created.desc()).all()

        # Build roster -> display name map
        rosters = session.query(Roster).filter_by(league_id=league_id).all()
        name_map = {}
        for r in rosters:
            owner = session.get(User, r.owner_id) if r.owner_id else None
            lu = session.query(LeagueUser).filter_by(league_id=league_id, user_id=r.owner_id).first() if r.owner_id else None
            team_name = None
            if lu and lu.user_metadata:
                team_name = lu.user_metadata.get("team_name")
            name_map[r.roster_id] = team_name if team_name else (f"Team {owner.display_name}" if owner else f"Roster {r.roster_id}")

        def resolve_player(pid):
            player = session.get(Player, pid) if pid and pid.isdigit() else None
            if player:
                return f"{player.first_name} {player.last_name}".strip()
            return pid

        def resolve_player_info(pid, txn_metadata=None, season=None):
            """Return full player info dict, preferring sync-time snapshot over current data."""
            # Use stored snapshot from sync time for historical accuracy
            if txn_metadata:
                stored = (txn_metadata or {}).get("_player_teams", {}).get(pid)
                if stored:
                    team_abbr = stored.get("team")
                    return {
                        "player_id": pid,
                        "name": stored.get("name", pid),
                        "position": stored.get("position", ""),
                        "team": team_abbr or "",
                        "player_img": f"{PLAYER_IMG}/{pid}.jpg" if pid and pid.isdigit() else None,
                        "team_logo": f"{TEAM_LOGO}/{team_abbr.lower()}.png" if team_abbr else None,
                    }
            # Fallback to current player lookup
            is_def = pid and not pid.isdigit()
            player = session.get(Player, pid) if pid and pid.isdigit() else None
            if not player and not is_def:
                return None
            team_abbr = player.team if player else (pid if is_def else None)
            # Retired players may have null team — check historical stats
            if not team_abbr and player and season:
                stat = session.query(PlayerWeeklyStat).filter(
                    PlayerWeeklyStat.player_id == pid,
                    PlayerWeeklyStat.season == season,
                    PlayerWeeklyStat.team.isnot(None),
                ).order_by(PlayerWeeklyStat.week.desc()).first()
                if stat and stat.team:
                    team_abbr = stat.team
            return {
                "player_id": pid,
                "name": f"{player.first_name} {player.last_name}".strip() if player else pid,
                "position": player.position if player else "DEF",
                "team": team_abbr or "",
                "player_img": f"{PLAYER_IMG}/{pid}.jpg" if pid and pid.isdigit() else None,
                "team_logo": f"{TEAM_LOGO}/{team_abbr.lower()}.png" if team_abbr else None,
            }

        def resolve_draft_pick(dp):
            return f"{dp.get('season', '?')} R{dp.get('round', '?')}" + (f" (from Roster {dp.get('previous_owner_id', '?')})" if dp.get('previous_owner_id') else "")

        # Build roster info map
        roster_info = {}
        for r in rosters:
            owner = session.get(User, r.owner_id) if r.owner_id else None
            lu = (
                session.query(LeagueUser)
                .filter_by(league_id=league_id, user_id=r.owner_id)
                .first()
            ) if r.owner_id else None
            team_name = None
            if lu and lu.user_metadata:
                team_name = lu.user_metadata.get("team_name")
            roster_info[r.roster_id] = {
                "roster_id": r.roster_id,
                "team_name": team_name if team_name else (f"Team {owner.display_name}" if owner else f"Roster {r.roster_id}"),
                "owner_avatar": f"{AVATAR_THUMB}/{owner.avatar}" if owner and owner.avatar else None,
            }

        result = []
        for t in q:
            dt = t.created
            entries = []
            rid_str = ", ".join(name_map.get(rid, f"Roster {rid}") for rid in (t.roster_ids or []))

            # Collect structured player moves & involved rosters
            player_adds = []
            player_drops = []
            involved_roster_ids = set(t.roster_ids or [])

            if t.type == "trade":
                for pid, rid in (t.adds or {}).items():
                    info = resolve_player_info(pid, t.txn_metadata, season)
                    if info:
                        rid_int = int(rid) if isinstance(rid, int) else rid
                        rin = roster_info.get(rid_int, {})
                        if rid_int not in involved_roster_ids:
                            involved_roster_ids.add(rid_int)
                        player_adds.append({**info, "roster_id": rid_int, "roster_name": rin.get("team_name", f"Roster {rid_int}"), "roster_avatar": rin.get("owner_avatar")})
                        player_name = info["name"]
                        roster_name = rin.get("team_name", f"Roster {rid_int}")
                        entries.append(f"{roster_name} gets {player_name}")
                for pid, rid in (t.drops or {}).items():
                    info = resolve_player_info(pid, t.txn_metadata, season)
                    if info:
                        rid_int = int(rid) if isinstance(rid, int) else rid
                        rin = roster_info.get(rid_int, {})
                        if rid_int not in involved_roster_ids:
                            involved_roster_ids.add(rid_int)
                        player_drops.append({**info, "roster_id": rid_int, "roster_name": rin.get("team_name", f"Roster {rid_int}"), "roster_avatar": rin.get("owner_avatar")})
                        player_name = info["name"]
                        roster_name = rin.get("team_name", f"Roster {rid_int}")
                        entries.append(f"{roster_name} drops {player_name}")
                for dp in (t.draft_picks or []):
                    pick_str = resolve_draft_pick(dp)
                    entries.append(f"Pick traded: {pick_str}")
                for wb in (t.waiver_budget or []):
                    entries.append(f"Roster {wb.get('sender', '?')} sends ${wb.get('amount', 0)} FAAB to Roster {wb.get('receiver', '?')}")

            elif t.type == "waiver":
                rid = t.roster_ids[0] if t.roster_ids else None
                roster_name = name_map.get(rid, f"Roster {rid}") if rid else "?"
                bid = (t.settings or {}).get("waiver_bid", 0)
                for pid, _rid in (t.adds or {}).items():
                    info = resolve_player_info(pid, t.txn_metadata, season)
                    if info:
                        player_adds.append({**info, "roster_id": rid, "roster_name": roster_name, "roster_avatar": roster_info.get(rid, {}).get("owner_avatar"), "waiver_bid": bid})
                        entries.append(f"{roster_name} claims {info['name']} (${bid})")
                for pid, _rid in (t.drops or {}).items():
                    info = resolve_player_info(pid, t.txn_metadata, season)
                    if info:
                        player_drops.append({**info, "roster_id": rid, "roster_name": roster_name, "roster_avatar": roster_info.get(rid, {}).get("owner_avatar")})
                        entries.append(f"{roster_name} drops {info['name']}")

            elif t.type == "free_agent":
                rid = t.roster_ids[0] if t.roster_ids else None
                roster_name = name_map.get(rid, f"Roster {rid}") if rid else "?"
                for pid, _rid in (t.adds or {}).items():
                    info = resolve_player_info(pid, t.txn_metadata, season)
                    if info:
                        player_adds.append({**info, "roster_id": rid, "roster_name": roster_name, "roster_avatar": roster_info.get(rid, {}).get("owner_avatar")})
                        entries.append(f"{roster_name} adds {info['name']}")
                for pid, _rid in (t.drops or {}).items():
                    info = resolve_player_info(pid, t.txn_metadata, season)
                    if info:
                        player_drops.append({**info, "roster_id": rid, "roster_name": roster_name, "roster_avatar": roster_info.get(rid, {}).get("owner_avatar")})
                        entries.append(f"{roster_name} drops {info['name']}")

            if entries:
                result.append({
                    "type": t.type,
                    "leg": t.leg,
                    "status": t.status,
                    "created": t.created,
                    "roster_names": rid_str,
                    "entries": entries,
                    "involved_rosters": [roster_info[rid] for rid in sorted(involved_roster_ids) if rid in roster_info],
                    "player_adds": player_adds,
                    "player_drops": player_drops,
                    "draft_picks": [resolve_draft_pick(dp) for dp in (t.draft_picks or [])] if t.type == "trade" else [],
                    "waiver_budget": t.waiver_budget or [],
                })

        return result


# In-memory cache: {(league_id, season) -> (players_out, rules)}
_player_stats_cache: dict[tuple[str, int], tuple[list[dict], dict]] = {}
_player_stats_cache_time: dict[tuple[str, int], float] = {}
_CACHE_TTL = 300  # 5 minutes


@app.get("/api/league/{league_id}/player-stats")
async def api_player_stats(
    league_id: str,
    position: str | None = None,
    week: int | None = None,
    search: str | None = None,
    owned: bool | None = None,
    sort: str | None = None,
    player_id: str | None = None,
    limit: int = 50,
    brief: bool = False,
):
    """Return player stats computed with the league's scoring settings."""
    import time

    with get_session() as session:
        league = session.get(League, league_id)
        if not league:
            raise HTTPException(404, "League not found")

        rules = league.scoring_settings or {}
        season = int(league.season)
        cache_key = (league_id, season)
        now = time.time()

        owned_ids: set[str] = set()
        owned_info: dict[str, dict] = {}
        rostered = session.query(Roster).filter_by(league_id=league_id).all()
        for r in rostered:
            for pid in (r.players or []):
                owned_ids.add(str(pid))
                if str(pid) not in owned_info:
                    from elfant.db.models import LeagueUser
                    owner = session.get(User, r.owner_id) if r.owner_id else None
                    lu = session.query(LeagueUser).filter_by(league_id=league_id, user_id=r.owner_id).first() if r.owner_id else None
                    tname = None
                    if lu and lu.user_metadata:
                        tname = lu.user_metadata.get("team_name")
                    owned_info[str(pid)] = {
                        "roster_name": tname if tname else (f"Team {owner.display_name}" if owner else f"Roster {r.roster_id}"),
                        "roster_avatar": f"{AVATAR_THUMB}/{owner.avatar}" if owner and owner.avatar else None,
                    }

        # Check cache
        cached_time = _player_stats_cache_time.get(cache_key)
        if cached_time and now - cached_time < _CACHE_TTL and cache_key in _player_stats_cache:
            all_players_out, cached_rules = _player_stats_cache[cache_key]
        else:
            # Load all players in a single bulk query — avoids 1700 individual DB lookups
            player_map: dict[str, dict] = {}
            for pl in session.query(Player).all():
                player_map[pl.player_id] = {
                    "name": f"{pl.first_name or ''} {pl.last_name or ''}".strip() or pl.player_id,
                    "position": pl.position or "",
                    "team": pl.team or "",
                    "status": pl.status or "",
                    "player_img": f"{PLAYER_IMG}/{pl.player_id}.jpg" if pl.player_id and pl.player_id.isdigit() else None,
                }

            # Query all stats for this season
            q = session.query(PlayerWeeklyStat).filter(
                PlayerWeeklyStat.season == season,
            )
            if week is not None:
                q = q.filter(PlayerWeeklyStat.week == week)

            stats_rows = q.all()

            # Aggregate per player
            player_stats: dict[str, dict] = {}
            for row in stats_rows:
                pid = row.player_id
                if pid not in player_stats:
                    player_stats[pid] = {"weeks_list": []}

                stat_dict = {
                    "completions": row.completions,
                    "attempts": row.attempts,
                    "passing_yards": row.passing_yards,
                    "passing_tds": row.passing_tds,
                    "passing_interceptions": row.passing_interceptions,
                    "passing_2pt_conversions": row.passing_2pt_conversions,
                    "rushing_yards": row.rushing_yards,
                    "rushing_tds": row.rushing_tds,
                    "rushing_2pt_conversions": row.rushing_2pt_conversions,
                    "receptions": row.receptions,
                    "receiving_yards": row.receiving_yards,
                    "receiving_tds": row.receiving_tds,
                    "receiving_2pt_conversions": row.receiving_2pt_conversions,
                    "fumbles_lost": row.fumbles_lost,
                    "fumbles": row.fumbles,
                    "fg_made": row.fg_made,
                    "fg_made_0_19": row.fg_made_0_19,
                    "fg_made_20_29": row.fg_made_20_29,
                    "fg_made_30_39": row.fg_made_30_39,
                    "fg_made_40_49": row.fg_made_40_49,
                    "fg_made_50_59": row.fg_made_50_59,
                    "fg_made_60_": row.fg_made_60_,
                    "pat_made": row.pat_made,
                    "def_sacks": row.def_sacks,
                    "def_interceptions": row.def_interceptions,
                    "def_tds": row.def_tds,
                    "def_safeties": row.def_safeties,
                    "pts_allowed": row.pts_allowed,
                    "yds_allowed": row.yds_allowed,
                    "fg_missed": row.fg_missed,
                    "pat_missed": row.pat_missed,
                    "fg_blocked": row.fg_blocked,
                    "pat_blocked": row.pat_blocked,
                    "punt_blocked": row.punt_blocked,
                    "fumble_recovery_opp": row.fumble_recovery_opp,
                    "fumble_recovery_tds": row.fumble_recovery_tds,
                    "fg_yds_bonus": row.fg_yds_bonus,
                    "def_4_and_stop": row.def_4_and_stop,
                    "def_3_and_out": row.def_3_and_out,
                    "kicks_blocked": row.kicks_blocked,
                }
                fp = fantasy_points(stat_dict, rules)

                player_stats[pid]["weeks_list"].append({
                    "week": row.week,
                    "season_type": row.season_type,
                    "team": row.team,
                    "opponent": row.opponent,
                    "fantasy_points": fp,
                })

            # Build full player list using the bulk-loaded player_map
            all_players_out = []
            for pid, data in player_stats.items():
                pl = player_map.get(pid)
                if not pl:
                    continue

                is_owned = pid in owned_ids
                weeks_list = data["weeks_list"]
                total = sum(w["fantasy_points"] for w in weeks_list)
                avg = round(total / len(weeks_list), 2) if weeks_list else 0

                last_team = pl["team"]
                if not last_team:
                    for w in weeks_list:
                        if w.get("team"):
                            last_team = w["team"]
                            break

                all_players_out.append({
                    "player_id": pid,
                    "name": pl["name"],
                    "position": pl["position"],
                    "team": last_team,
                    "status": pl["status"],
                    "player_img": pl["player_img"],
                    "team_logo": f"{TEAM_LOGO}/{last_team.lower()}.png" if last_team else None,
                    "owned": is_owned,
                    "roster_name": owned_info.get(pid, {}).get("roster_name") if is_owned else None,
                    "roster_avatar": owned_info.get(pid, {}).get("roster_avatar") if is_owned else None,
                    "weeks": [] if brief else weeks_list,
                    "total_points": total,
                    "avg_points": avg,
                    "games": len(weeks_list),
                    "floor": min(w["fantasy_points"] for w in weeks_list) if weeks_list else 0,
                    "ceiling": max(w["fantasy_points"] for w in weeks_list) if weeks_list else 0,
                    "std_dev": round((sum((w["fantasy_points"] - avg) ** 2 for w in weeks_list) / len(weeks_list)) ** 0.5, 2) if weeks_list else 0,
                    "bust_rate": round(sum(1 for w in weeks_list if w["fantasy_points"] < 10) / len(weeks_list) * 100, 1) if weeks_list else 0,
                })

            # Compute rankings
            if all_players_out:
                sort_key = {"total": "total_points", "avg": "avg_points", "name": "name"}.get(sort or "total", "total_points")
                if sort_key == "name":
                    all_players_out.sort(key=lambda x: x["name"])
                else:
                    all_players_out.sort(key=lambda x: -x[sort_key])

                if sort_key != "name":
                    for i, p in enumerate(all_players_out):
                        p["overall_rank"] = i + 1

                    pos_groups: dict[str, list] = {}
                    for p in all_players_out:
                        pos_groups.setdefault(p["position"], []).append(p)
                    for group in pos_groups.values():
                        group.sort(key=lambda x: -x["total_points"])
                        for i, p in enumerate(group):
                            p["position_rank"] = i + 1

            # Store in cache
            _player_stats_cache[cache_key] = (all_players_out, rules)
            _player_stats_cache_time[cache_key] = now

        # Apply filters after ranking (don't re-rank — keep rankings from full set)
        players_out = all_players_out
        if position:
            players_out = [p for p in players_out if p["position"] == position]
        if search:
            players_out = [p for p in players_out if search.lower() in p["name"].lower()]
        if owned is True:
            players_out = [p for p in players_out if p["owned"]]
        if owned is False:
            players_out = [p for p in players_out if not p["owned"]]
        if player_id:
            players_out = [p for p in players_out if p["player_id"] == player_id]

        # Limit results for non-single-player queries
        if not player_id and limit and len(players_out) > limit:
            players_out = players_out[:limit]

        return {"players": players_out, "scoring_rules": rules}


@app.get("/api/league/{league_id}/player/{player_id}/career")
async def api_player_career(league_id: str, player_id: str):
    """Return multi-year career stats computed with the league's scoring settings."""
    with get_session() as session:
        league = session.get(League, league_id)
        if not league:
            raise HTTPException(404, "League not found")

        rules = league.scoring_settings or {}
        player = session.get(Player, player_id)
        if not player:
            raise HTTPException(404, "Player not found")

        stats = session.query(PlayerWeeklyStat).filter(
            PlayerWeeklyStat.player_id == player_id,
        ).order_by(PlayerWeeklyStat.season, PlayerWeeklyStat.week).all()

        # Group by season
        season_map: dict[int, list] = {}
        for row in stats:
            season_map.setdefault(row.season, []).append(row)

        seasons_out = []
        for season, rows in sorted(season_map.items(), reverse=True):
            weeks = []
            total = 0.0
            for row in rows:
                stat_dict = {
                    "completions": row.completions,
                    "attempts": row.attempts,
                    "passing_yards": row.passing_yards,
                    "passing_tds": row.passing_tds,
                    "passing_interceptions": row.passing_interceptions,
                    "passing_2pt_conversions": row.passing_2pt_conversions,
                    "rushing_yards": row.rushing_yards,
                    "rushing_tds": row.rushing_tds,
                    "rushing_2pt_conversions": row.rushing_2pt_conversions,
                    "receptions": row.receptions,
                    "receiving_yards": row.receiving_yards,
                    "receiving_tds": row.receiving_tds,
                    "receiving_2pt_conversions": row.receiving_2pt_conversions,
                    "fumbles_lost": row.fumbles_lost,
                    "fumbles": row.fumbles,
                    "fg_made": row.fg_made,
                    "fg_made_0_19": row.fg_made_0_19,
                    "fg_made_20_29": row.fg_made_20_29,
                    "fg_made_30_39": row.fg_made_30_39,
                    "fg_made_40_49": row.fg_made_40_49,
                    "fg_made_50_59": row.fg_made_50_59,
                    "fg_made_60_": row.fg_made_60_,
                    "pat_made": row.pat_made,
                    "def_sacks": row.def_sacks,
                    "def_interceptions": row.def_interceptions,
                    "def_tackles_solo": row.def_tackles_solo,
                    "def_tackles_with_assist": row.def_tackles_with_assist,
                    "def_tackles_for_loss": row.def_tackles_for_loss,
                    "def_pass_defended": row.def_pass_defended,
                    "def_fumbles_forced": row.def_fumbles_forced,
                    "def_tds": row.def_tds,
                    "def_safeties": row.def_safeties,
                    "special_teams_tds": row.special_teams_tds,
                    "pts_allowed": row.pts_allowed,
                    "yds_allowed": row.yds_allowed,
                    "fg_missed": row.fg_missed,
                    "pat_missed": row.pat_missed,
                    "fg_blocked": row.fg_blocked,
                    "pat_blocked": row.pat_blocked,
                    "punt_blocked": row.punt_blocked,
                    "fumble_recovery_opp": row.fumble_recovery_opp,
                    "fumble_recovery_tds": row.fumble_recovery_tds,
                    "fg_yds_bonus": row.fg_yds_bonus,
                    "def_4_and_stop": row.def_4_and_stop,
                    "def_3_and_out": row.def_3_and_out,
                    "kicks_blocked": row.kicks_blocked,
                }
                fp = fantasy_points(stat_dict, rules)
                total += fp
                weeks.append({
                    "week": row.week,
                    "season_type": row.season_type,
                    "team": row.team,
                    "opponent": row.opponent,
                    "fantasy_points": fp,
                    "carries": row.carries,
                    "targets": row.targets,
                    "receptions": row.receptions,
                    "completions": row.completions,
                    "attempts": row.attempts,
                    "passing_yards": row.passing_yards,
                    "passing_tds": row.passing_tds,
                    "passing_interceptions": row.passing_interceptions,
                    "receiving_yards": row.receiving_yards,
                    "receiving_tds": row.receiving_tds,
                    "rushing_yards": row.rushing_yards,
                    "rushing_tds": row.rushing_tds,
                })

            fps = [w["fantasy_points"] for w in weeks]
            floor = min(fps) if fps else 0
            ceiling = max(fps) if fps else 0
            avg = sum(fps) / len(fps) if fps else 0
            variance = sum((x - avg) ** 2 for x in fps) / len(fps) if fps else 0
            std_dev = round(variance ** 0.5, 2)

            # Usage aggregates
            total_carries = sum(w.get("carries") or 0 for w in weeks)
            total_targets = sum(w.get("targets") or 0 for w in weeks)
            total_receptions = sum(w.get("receptions") or 0 for w in weeks)
            total_attempts = sum(w.get("attempts") or 0 for w in weeks)
            total_completions = sum(w.get("completions") or 0 for w in weeks)

            seasons_out.append({
                "season": season,
                "team": rows[-1].team or rows[0].team or "",
                "games": len(rows),
                "games_possible": 17 if season >= 2021 else 16,
                "total_points": round(total, 2),
                "avg_points": round(avg, 2),
                "floor": round(floor, 2),
                "ceiling": round(ceiling, 2),
                "std_dev": std_dev,
                "bust_rate": round(sum(1 for x in fps if x < 10) / len(fps) * 100, 1) if fps else 0,
                "usage": {
                    "carries": total_carries,
                    "carries_per_game": round(total_carries / len(weeks), 1) if weeks else 0,
                    "targets": total_targets,
                    "targets_per_game": round(total_targets / len(weeks), 1) if weeks else 0,
                    "receptions": total_receptions,
                    "receptions_per_game": round(total_receptions / len(weeks), 1) if weeks else 0,
                    "attempts": total_attempts,
                    "attempts_per_game": round(total_attempts / len(weeks), 1) if weeks else 0,
                    "completions": total_completions,
                    "completion_pct": round(total_completions / total_attempts * 100, 1) if total_attempts else 0,
                    "yards_per_carry": round(sum(w.get("rushing_yards") or 0 for w in weeks) / total_carries, 1) if total_carries else 0,
                    "yards_per_target": round(sum(w.get("receiving_yards") or 0 for w in weeks) / total_targets, 1) if total_targets else 0,
                },
                "weeks": weeks,
            })

        return {
            "player_id": player_id,
            "name": f"{player.first_name or ''} {player.last_name or ''}".strip() or player_id,
            "position": player.position or "",
            "player_img": f"{PLAYER_IMG}/{player_id}.jpg" if player_id and player_id.isdigit() else None,
            "seasons": seasons_out,
        }


@app.get("/api/player/{player_id}/schedule")
async def api_player_schedule(player_id: str, season: int | None = None):
    """Return the full season schedule for a player's team, marking played weeks."""
    import datetime

    with get_session() as session:
        player = session.get(Player, player_id)
        if not player:
            raise HTTPException(404, "Player not found")

        if season is None:
            season = datetime.date.today().year

        # Load schedule from nflreadpy
        try:
            import nflreadpy as nfl
        except ImportError:
            return {"games": []}

        sched_df = nfl.load_schedules(seasons=[season])
        if sched_df.is_empty():
            return {"games": []}

        # Determine player's team from most recent week
        last_stat = session.query(PlayerWeeklyStat).filter(
            PlayerWeeklyStat.player_id == player_id,
            PlayerWeeklyStat.season == season,
            PlayerWeeklyStat.team.isnot(None),
        ).order_by(PlayerWeeklyStat.week.desc()).first()

        if not last_stat or not last_stat.team:
            return {"games": []}

        team = last_stat.team

        # Get all games for this team
        games = []
        for row in sched_df.iter_rows(named=True):
            if row.get("away_team") != team and row.get("home_team") != team:
                continue

            is_home = row.get("home_team") == team
            opponent = row.get("away_team") if is_home else row.get("home_team")
            week = row.get("week", 0)
            gameday = row.get("gameday", "")
            away_score = row.get("away_score")
            home_score = row.get("home_score")

            # Check if we have stats for this week (means game played)
            had_game = session.query(PlayerWeeklyStat).filter(
                PlayerWeeklyStat.player_id == player_id,
                PlayerWeeklyStat.season == season,
                PlayerWeeklyStat.week == week,
            ).first() is not None

            games.append({
                "week": week,
                "is_home": is_home,
                "opponent": opponent,
                "opponent_logo": f"{TEAM_LOGO}/{opponent.lower()}.png",
                "gameday": gameday,
                "played": had_game,
                "result": "W" if (is_home and home_score and away_score and home_score > away_score) or (not is_home and away_score and home_score and away_score > home_score) else "L" if (away_score is not None and home_score is not None) else None,
            })

        games.sort(key=lambda x: x["week"])
        return {"team": team, "team_logo": f"{TEAM_LOGO}/{team.lower()}.png", "games": games}


# ---- SPA static file serving ----

if os.path.isdir(FRONTEND_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = os.path.join(FRONTEND_DIST, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        index = os.path.join(FRONTEND_DIST, "index.html")
        return FileResponse(index, media_type="text/html")
