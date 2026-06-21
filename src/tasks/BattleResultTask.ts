import { query } from "../db"
import { RecordCondition, TableChangeTask } from "../utils/task"

type Ctx = {
  playerName?: string
  battleMode?: string
  region?: string
}

type BattleResult = {
  id: string
  battleMode: string
  playerName: string
  region: string
}

export class BattleResultTask extends TableChangeTask<Ctx, BattleResult, RecordCondition<BattleResult>> {
  private lastProcessedId: string | null = null;

  parseQueries(queries: Record<string, string[]>): Ctx {
    return {
      playerName: queries.playerName?.[0],
      battleMode: queries.battleMode?.[0],
      region: queries.region?.[0]
    }
  }

  getChannelKey(ctx: Ctx) {
    return `${this.channel}:${ctx.playerName || 'all'}:${ctx.battleMode || 'all'}:${ctx.region || 'all'}`
  }

  createCondition(ctx: Ctx) {
    return new RecordCondition(this.getChannelKey(ctx), {
      playerName: ctx.playerName,
      battleMode: ctx.battleMode,
      region: ctx.region
    })
  }

  async loadData() {
    if (!this.lastProcessedId) {
      const result = await query<{ id: string }>(`select toString(max(id)) as id from Event_OnBattleResult`)
      this.lastProcessedId = result.data[0]?.id ?? null;
    }

    if (!this.lastProcessedId) throw new Error("Failed to retrieve the last processed ID from the database.");

    const result = await query<{ id: string, battleMode: string, playerName: string, region: string }>(`
        select toString(id) as id, battleMode, playerName, region
        from Event_OnBattleResult
        where id > '${this.lastProcessedId}' and dateTime > now() - interval 1 minute
        order by id desc
      `)

    if (result.data.length === 0) return [];
    this.lastProcessedId = result.data[0]!.id;

    return result.data
  }
}
