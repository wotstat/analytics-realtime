import { query } from '../db'

type Snapshot = { day: string, recalculation: string }
type SnapshotRow = Snapshot & { region: string }

export async function comp7LastRecalculation() {
  const [result, dailyResult] = await Promise.all([
    query<SnapshotRow>(`
      select region, max(day) as day, max(recalculationTime) as recalculation
      from Comp7Leaderboard
      group by region`, { use_query_cache: 0 }),

    query<SnapshotRow>(`
      select region, max(day) as day, max(lastRecalculationTime) as recalculation
      from Comp7LeaderboardDailyByRank
      group by region`, { use_query_cache: 0 }),
  ])

  if (result.data.length === 0) return null

  const dailyByRegion = new Map(dailyResult.data.map(row => [row.region, { day: row.day, recalculation: row.recalculation }]))
  const res: Record<string, Snapshot & { daily?: Snapshot }> = {}

  for (const row of result.data) {
    res[row.region] = { day: row.day, recalculation: row.recalculation, daily: dailyByRegion.get(row.region) }
  }

  return res
}
