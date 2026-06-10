import { query } from "../db";


export async function comp7LastRecalculation() {
  const result = await query<{ region: string, day: string, recalculation: string }>(`
    select region, max(day) as day, max(recalculationTime) as recalculation
    from Comp7Leaderboard
    group by region`)


  if (result.data.length === 0) return null;

  const res = {} as Record<string, { day: string, recalculation: string }>;

  for (const row of result.data) {
    res[row.region] = { day: row.day, recalculation: row.recalculation }
  }

  return res;
}