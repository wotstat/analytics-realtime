import { query } from "../db";


export async function totalEvents() {
  const result = await query<{ data: number }>(`select (select count() from Event_OnBattleResult) + 
      (select count() from Event_OnShot) + 
      (select count() from Event_OnBattleResult) +
      (select count() from Event_OnLootboxOpen) as count,
      toUInt32(count) as data`)

  return result.data[0]?.data ?? 0;
}