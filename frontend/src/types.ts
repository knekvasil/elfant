export interface League {
  league_id: string
  name: string
  season: string
  status: string
  total_rosters: number
  previous_league_id: string | null
}

export interface Roster {
  roster_id: number
  owner_id: string
  owner_display: string | null
  owner_avatar: string | null
  team_name: string | null
  wins: number
  losses: number
  ties: number
  fpts: number
  fpts_against: number
  waiver_position: number | null
  waiver_budget_used: number | null
  total_moves: number
}

export interface Player {
  player_id: string
  name: string
  position: string
  team: string
  points: number
  player_img: string | null
  team_logo: string | null
}

export interface DraftPick {
  pick_no: number
  round: number
  roster_id: number | null
  player_id: string | null
  first_name: string | null
  last_name: string | null
  team: string | null
  position: string | null
  team_logo: string | null
}

export interface Draft {
  draft_id: string
  season: string
  type: string
  status: string
  picks: DraftPick[]
}

export interface MatchupEntry {
  matchup_id: number | string
  team_name: string
  team_avatar: string | null
  points: number
  result: 'win' | 'loss' | 'tie'
  record: string
  rank: number
  starters: Player[]
  bench: Player[]
  opp_name: string
  opp_avatar: string | null
  opp_points: number
  opp_result: 'win' | 'loss' | 'tie'
  opp_record: string
  opp_rank: number
  opp_starters: Player[]
  opp_bench: Player[]
}

export interface BracketMatch {
  round: number
  match_id: number
  team_1: number | null
  team_1_name: string | null
  team_1_avatar: string | null
  team_1_owner: string | null
  team_1_score: number | null
  team_2: number | null
  team_2_name: string | null
  team_2_avatar: string | null
  team_2_owner: string | null
  team_2_score: number | null
  team_1_from: { w?: number; l?: number } | null
  team_2_from: { w?: number; l?: number } | null
  winner: number | null
  winner_name: string | null
  winner_score: number | null
  loser: number | null
  loser_name: string | null
  loser_score: number | null
  position: number | null
}

export interface PlayoffData {
  winners: BracketMatch[]
  losers: BracketMatch[]
}

export interface SeasonRef {
  league_id: string
  name: string
  season: string
  status: string
  total_rosters: number
}

export interface LeagueChain {
  league_id: string
  group_id: string
  name: string
  seasons: SeasonRef[]
}

export interface SeasonOverview {
  league_id: string
  name: string
  season: string
  status: string
  total_rosters: number
  champion: string | null
  champion_owner: string | null
  champion_avatar: string | null
  runner_up: string | null
  runner_up_owner: string | null
}

export interface OwnerSeasonParticipation {
  team_name: string | null
  present: boolean
}

export interface OwnerParticipant {
  owner_id: string
  display_name: string | null
  avatar: string | null
  seasons: Record<string, OwnerSeasonParticipation>
  group: string
}

export interface ParticipantsData {
  seasons: string[]
  old_guard: OwnerParticipant[]
  newcomers: OwnerParticipant[]
  previously_left: OwnerParticipant[]
}

export interface LeagueOverviewData {
  group_id: string
  name: string
  seasons: SeasonOverview[]
  total_seasons: number
  total_teams: number
  participants: ParticipantsData
}

export interface LeagueData {
  league: League
  rosters: Roster[]
  previous: League | null
  next: League | null
  drafts: Draft[]
  max_week: number
}

export interface RankingRoster {
  roster_id: number
  name: string
  owner: string | null
  avatar: string | null
  rankings: number[]
  pf_diffs: number[]
  median_wins: number
  total_weeks: number
  all_play_wins: number
  avg_efficiency: number
  optimal_wins: number
}

export interface PlayerWeek {
  week: number
  season_type: string
  team: string
  opponent: string
  fantasy_points: number
  carries?: number
  targets?: number
  receptions?: number
  completions?: number
  attempts?: number
  passing_yards?: number
  passing_tds?: number
  passing_interceptions?: number
  rushing_yards?: number
  rushing_tds?: number
  receiving_yards?: number
  receiving_tds?: number
}

export interface PlayerStats {
  player_id: string
  name: string
  position: string
  team: string
  status: string
  player_img: string | null
  team_logo: string | null
  owned: boolean
  roster_name?: string | null
  roster_avatar?: string | null
  weeks: PlayerWeek[]
  total_points: number
  avg_points: number
  games: number
  floor: number
  ceiling: number
  std_dev: number
  bust_rate: number
  overall_rank?: number
  position_rank?: number
}

export interface PlayerStatsResponse {
  players: PlayerStats[]
  scoring_rules: Record<string, number>
}

export interface PlayerUsage {
  carries: number
  carries_per_game: number
  targets: number
  targets_per_game: number
  receptions: number
  receptions_per_game: number
  attempts: number
  attempts_per_game: number
  completions: number
  completion_pct: number
  yards_per_carry: number
  yards_per_target: number
}

export interface PlayerCareerSeason {
  season: number
  team: string
  games: number
  games_possible: number
  total_points: number
  avg_points: number
  floor: number
  ceiling: number
  std_dev: number
  bust_rate: number
  usage: PlayerUsage
  weeks: PlayerWeek[]
}

export interface PlayerCareerResponse {
  player_id: string
  name: string
  position: string
  player_img: string | null
  seasons: PlayerCareerSeason[]
}

export interface ScheduleGame {
  week: number
  is_home: boolean
  opponent: string
  opponent_logo: string
  gameday: string
  played: boolean
  result: string | null
}

export interface PlayerScheduleResponse {
  team: string
  team_logo: string
  games: ScheduleGame[]
}

export interface RankingsData {
  weeks: number[]
  rosters: RankingRoster[]
}

export interface TeamWeekStats {
  pf: number
  pa: number
  league_avg: number
  all_play_wins: number
  all_play_total: number
  optimal: number
  efficiency: number
  optimal_wins: number
}

export interface TeamStatsRoster {
  roster_id: number
  name: string
  owner: string | null
  avatar: string | null
  weekly: TeamWeekStats[]
  season_avg: number
  season_std: number
  bust_rate: number
  all_play_wins: number
  all_play_total: number
  avg_efficiency: number
  optimal_wins: number
}

export interface TeamStatsData {
  weeks: number[]
  rosters: TeamStatsRoster[]
}

export interface PlayerMove {
  player_id: string
  name: string
  position: string
  team: string
  player_img: string | null
  team_logo: string | null
  roster_id: number | null
  roster_name: string
  roster_avatar: string | null
  waiver_bid?: number
}

export interface RosterBrief {
  roster_id: number
  team_name: string
  owner_avatar: string | null
}

export interface TransactionEntry {
  type: string
  leg: number
  status: string
  created: number
  roster_names: string
  entries: string[]
  involved_rosters: RosterBrief[]
  player_adds: PlayerMove[]
  player_drops: PlayerMove[]
  draft_picks: string[]
  waiver_budget: { sender: number; receiver: number; amount: number }[]
}
