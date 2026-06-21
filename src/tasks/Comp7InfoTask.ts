import { query } from "../db"
import { RecordCondition, TableChangeTask } from "../utils/task"

type Ctx = {
  playerName?: string
  region?: string
}

type Comp7InfoResult = {
  id: string
  rating: number
  playerName: string
  region: string
}

export class Comp7InfoTask extends TableChangeTask<Ctx, Comp7InfoResult, RecordCondition<Comp7InfoResult>> {
  private lastProcessedId: string | null = null;

  parseQueries(queries: Record<string, string[]>): Ctx {
    return {
      playerName: queries.playerName?.[0],
      region: queries.region?.[0]
    }
  }

  getChannelKey(ctx: Ctx) {
    return `${this.channel}:${ctx.playerName || 'all'}:${ctx.region || 'all'}`
  }

  createCondition(ctx: Ctx) {
    return new RecordCondition(this.getChannelKey(ctx), {
      playerName: ctx.playerName,
      region: ctx.region
    })
  }

  async loadData() {
    if (!this.lastProcessedId) {
      const result = await query<{ id: string }>(`select toString(max(id)) as id from Event_OnComp7Info`)
      this.lastProcessedId = result.data[0]?.id ?? null;
    }

    if (!this.lastProcessedId) throw new Error("Failed to retrieve the last processed ID from the database.");

    const result = await query<Comp7InfoResult>(`
      select toString(id) as id, playerName, region, rating
      from Event_OnComp7Info
      where id > '${this.lastProcessedId}' and dateTime > now() - interval 1 minute
      order by id desc
    `)

    if (result.data.length === 0) return [];
    this.lastProcessedId = result.data[0]!.id;

    return result.data
  }
}
