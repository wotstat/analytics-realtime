import { query } from "../db";


export async function totalEvents() {
  const result = await query<{ count: number }>(`select (select count() from Event_OnBattleResult) + 
      (select count() from Event_OnShot) + 
      (select count() from Event_OnBattleResult) +
      (select count() from Event_OnLootboxOpen) as count`)

  return result.data[0]?.count ?? 0;
}