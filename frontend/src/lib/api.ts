import type { LeagueData, MatchupEntry, PlayoffData, RankingsData, TransactionEntry, PlayerStatsResponse, PlayerCareerResponse } from '../types'

const BASE = '/api'

export async function fetchLeague(leagueId: string): Promise<LeagueData> {
  const res = await fetch(`${BASE}/league/${leagueId}`)
  if (!res.ok) throw new Error(`League not found (${res.status})`)
  return res.json()
}

export async function fetchMatchups(
  leagueId: string,
  week: number
): Promise<MatchupEntry[]> {
  const res = await fetch(`${BASE}/league/${leagueId}/matchups/${week}`)
  if (!res.ok) throw new Error(`Matchups not found (${res.status})`)
  return res.json()
}

export async function refreshLeague(leagueId: string): Promise<void> {
  await fetch(`${BASE}/league/${leagueId}/refresh`, { method: 'POST' })
}

export async function fetchRankings(leagueId: string, mode?: string): Promise<RankingsData> {
  const query = mode && mode !== 'standard' ? `?mode=${mode}` : ''
  const res = await fetch(`${BASE}/league/${leagueId}/rankings${query}`)
  if (!res.ok) throw new Error(`Rankings not found (${res.status})`)
  return res.json()
}

export async function fetchTransactions(leagueId: string): Promise<TransactionEntry[]> {
  const res = await fetch(`${BASE}/league/${leagueId}/transactions`)
  if (!res.ok) throw new Error(`Transactions not found (${res.status})`)
  return res.json()
}

export async function fetchPlayoffs(leagueId: string): Promise<PlayoffData> {
  const res = await fetch(`${BASE}/league/${leagueId}/playoffs`)
  if (!res.ok) throw new Error(`Playoffs not found (${res.status})`)
  return res.json()
}

export async function fetchPlayerStats(
  leagueId: string,
  params?: {
    position?: string
    week?: number
    search?: string
    owned?: boolean
    sort?: string
    player_id?: string
    limit?: number
    brief?: boolean
  },
): Promise<PlayerStatsResponse> {
  const query = new URLSearchParams()
  if (params?.position) query.set('position', params.position)
  if (params?.week != null) query.set('week', String(params.week))
  if (params?.search) query.set('search', params.search)
  if (params?.owned != null) query.set('owned', params.owned ? 'true' : 'false')
  if (params?.sort) query.set('sort', params.sort)
  if (params?.player_id) query.set('player_id', params.player_id)
  if (params?.limit != null) query.set('limit', String(params.limit))
  if (params?.brief != null) query.set('brief', params.brief ? 'true' : 'false')
  const qs = query.toString()
  const url = `${BASE}/league/${leagueId}/player-stats${qs ? `?${qs}` : ''}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Player stats not found (${res.status})`)
  return res.json()
}

export async function fetchPlayerCareer(leagueId: string, playerId: string): Promise<PlayerCareerResponse> {
  const res = await fetch(`${BASE}/league/${leagueId}/player/${playerId}/career`)
  if (!res.ok) throw new Error(`Player career not found (${res.status})`)
  return res.json()
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

export async function fetchPlayerSchedule(playerId: string, season?: number): Promise<PlayerScheduleResponse> {
  const query = season ? `?season=${season}` : ''
  const res = await fetch(`${BASE}/player/${playerId}/schedule${query}`)
  if (!res.ok) throw new Error(`Player schedule not found (${res.status})`)
  return res.json()
}
