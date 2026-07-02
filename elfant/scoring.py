"""Fantasy scoring engine — computes points from raw stats + per-league rules."""

# Maps raw stat key → (Sleeper scoring rule key, default multiplier)
STAT_RULES = [
    ("passing_yards",           "pass_yd",          0.04),
    ("passing_tds",             "pass_td",          4),
    ("passing_interceptions",   "pass_int",         -1),
    ("passing_2pt_conversions", "pass_2pt",         2),
    ("rushing_yards",           "rush_yd",          0.1),
    ("rushing_tds",             "rush_td",          6),
    ("rushing_2pt_conversions", "rush_2pt",         2),
    ("receptions",              "rec",              1),
    ("receiving_yards",         "rec_yd",           0.1),
    ("receiving_tds",           "rec_td",           6),
    ("receiving_2pt_conversions","rec_2pt",         2),
    ("fumbles_lost",            "fum_lost",         -2),
    ("fumbles",                 "fum",              0),
    ("special_teams_tds",       "st_td",            6),
    ("fumble_recovery_opp",     "fum_rec",          0),
    ("fumble_recovery_tds",     "fum_rec_td",       0),
    ("def_tackles_solo",        "def_tkl_solo",     0),
    ("def_tackles_with_assist", "def_tkl_asst",     0),
    ("def_tackles_for_loss",    "tkl_loss",         0),
    ("def_sacks",               "sack",             1),
    ("def_interceptions",       "int",              2),
    ("def_pass_defended",       "def_pass_def",     0),
    ("def_fumbles_forced",      "ff",               1),
    ("def_tds",                 "def_td",           6),
    ("def_safeties",            "safe",             2),
    ("pts_allowed",             "pts_allow",        0),
    ("fg_made",                 "fgm",              3),
    ("fg_made_0_19",            "fgm_0_19",         0),
    ("fg_made_20_29",           "fgm_20_29",        0),
    ("fg_made_30_39",           "fgm_30_39",        0),
    ("fg_made_40_49",           "fgm_40_49",        0),
    ("fg_made_50_59",           "fgm_50_59",        0),
    ("fg_made_60_",             "fgm_60p",          0),
    ("pat_made",                "xpm",              1),
    ("pat_att",                 "xpm_att",          0),
    ("fg_missed",               "fgmiss",           0),
    ("pat_missed",              "xpmiss",           0),
    ("fg_yds_bonus",            "fgm_yds_over_30",  0),
    ("def_4_and_stop",          "def_4_and_stop",   0),
    ("def_3_and_out",           "def_3_and_out",    0),
]

SCORING_KEYS = {rule_key for _, rule_key, _ in STAT_RULES}


def fantasy_points(stats: dict, rules: dict) -> float:
    """Compute fantasy points from raw weekly stats + league scoring settings.

    Args:
        stats: Dict with raw stat keys (e.g. {'passing_yards': 280, 'passing_tds': 3})
        rules: League scoring_settings dict from Sleeper API

    Returns:
        Total fantasy points rounded to 2 decimals
    """
    total = 0.0
    for stat_key, rule_key, default in STAT_RULES:
        raw_val = stats.get(stat_key) or 0
        multiplier = rules.get(rule_key, default)
        total += raw_val * multiplier

    # Detect if this is a defense stat line for rule disambiguation
    is_defense = bool(stats.get("def_sacks") or stats.get("def_interceptions") or stats.get("def_tackles_solo"))

    # Special teams TD: use def_st_td for defenses, st_td for individuals
    st_tds = stats.get("special_teams_tds") or 0
    if st_tds:
        st_td_mult = rules.get("def_st_td" if is_defense else "st_td", 6)
        # Remove st_td already applied by STAT_RULES and apply the correct one
        total -= st_tds * rules.get("st_td", 6)
        total += st_tds * st_td_mult

    # Undo kicker stats erroneously attributed to defense from team-level data
    if is_defense:
        total -= (stats.get("fg_missed") or 0) * rules.get("fgmiss", 0)
        total -= (stats.get("pat_missed") or 0) * rules.get("xpmiss", 0)
        total -= (stats.get("fg_yds_bonus") or 0) * rules.get("fgm_yds_over_30", 0)

    # Blocked kick bonus — prefer PBP-derived total, fall back to team stats
    total += (stats.get("kicks_blocked") or 0) * rules.get("blk_kick", 0)

    # Points-allowed bucket bonus/penalty (e.g. pts_allow_0, pts_allow_14_20, pts_allow_35p)
    pts_allowed = stats.get("pts_allowed") or 0
    if pts_allowed:
        pts_buckets: list[tuple[int, str, int] | tuple[int, str]] = [
            (0, "pts_allow_0", 0),
            (1, "pts_allow_1_6", 6),
            (7, "pts_allow_7_13", 13),
            (14, "pts_allow_14_20", 20),
            (21, "pts_allow_21_27", 27),
            (28, "pts_allow_28_34", 34),
            (35, "pts_allow_35p"),
        ]
        for entry in pts_buckets:
            hi = entry[2] if len(entry) > 2 else 999
            if pts_allowed <= hi:
                total += rules.get(entry[1], 0)
                break

    # Yards-allowed bucket penalty (e.g. yds_allow_350_399, yds_allow_400_449, ...)
    yds_allowed = stats.get("yds_allowed") or 0
    if yds_allowed:
        yds_buckets: list[tuple[int, str, int] | tuple[int, str]] = [
            (0, "yds_allow_0_349", 349),
            (350, "yds_allow_350_399", 399),
            (400, "yds_allow_400_449", 449),
            (450, "yds_allow_450_499", 499),
            (500, "yds_allow_500_549", 549),
            (550, "yds_allow_550p"),
        ]
        for entry in yds_buckets:
            hi = entry[2] if len(entry) > 2 else 9999
            if yds_allowed <= hi:
                total += rules.get(entry[1], 0)
                break

    return round(total, 2)
