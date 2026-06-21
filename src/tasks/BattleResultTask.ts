import nodeCron from "node-cron"
import { query } from "../db"
import { BaseTask } from "../SchedulerEmitter"
import { HashMap, HashSet, type Hashable } from "../utils/HashSet"

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

class Condition implements Hashable {
  private readonly hashValue: string
  readonly channelKey: string

  constructor(readonly ctx: Ctx) {
    this.hashValue = `${ctx.playerName || 'all'}:${ctx.battleMode || 'all'}:${ctx.region || 'all'}`
    this.channelKey = getChannelKey('battleResult', ctx)
  }

  hash(): string {
    return this.hashValue
  }

  check(battleResult: BattleResult): boolean {
    if (this.ctx.playerName && this.ctx.playerName !== battleResult.playerName) return false
    if (this.ctx.battleMode && this.ctx.battleMode !== battleResult.battleMode) return false
    if (this.ctx.region && this.ctx.region !== battleResult.region) return false
    return true
  }
}

function parseQueries(queries: Record<string, string[]>): Ctx {
  return {
    playerName: queries.playerName?.[0],
    battleMode: queries.battleMode?.[0],
    region: queries.region?.[0]
  }
}

function getChannelKey(channel: string, ctx: Ctx) {
  return `${channel}:${ctx.playerName || 'all'}:${ctx.battleMode || 'all'}:${ctx.region || 'all'}`
}

export class BattleResultTask extends BaseTask {
  private activeChannel = new HashMap<Condition, number>()
  private isRunning = false;
  private lastProcessedId: string | null = null;

  constructor(channel: string, cron: string = '* * * * * *') {
    super(channel);

    nodeCron.schedule(cron, () => this.executeTask());

    const delay = Math.floor(Math.random() * 10000);
    console.log(`Scheduled task '${channel}' with cron: ${cron}. Starting in ${delay}ms...`);
    setTimeout(() => this.executeTask(), delay);
  }

  override onConnect(queries: Record<string, string[]>, client: Bun.ServerWebSocket<any>): void {
    const ctx = parseQueries(queries);
    const key = this.getChannelKey(ctx);
    client.subscribe(key);

    const condition = new Condition(ctx);
    const count = this.activeChannel.get(condition) || 0;
    this.activeChannel.set(condition, count + 1);
  }

  override onDisconnect(queries: Record<string, string[]>, client: Bun.ServerWebSocket<any>): void {
    const ctx = parseQueries(queries);
    const key = this.getChannelKey(ctx);
    client.unsubscribe(key);

    const condition = new Condition(ctx);
    const count = this.activeChannel.get(condition) || 0;
    this.activeChannel.set(condition, count - 1);
  }

  publishResult(channel: string, data: any): void {
    this.server?.publish(channel, JSON.stringify(data));
  }

  getChannelKey(ctx: Ctx) {
    return getChannelKey(this.channel, ctx);
  }

  private async executeTask() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {

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

      if (result.data.length === 0) return;

      this.lastProcessedId = result.data[0]!.id

      for (const [condition, count] of this.activeChannel.entries()) {
        if (count <= 0) {
          this.activeChannel.delete(condition);
          continue;
        }

        const res = result.data.filter(condition.check.bind(condition));
        if (res.length === 0) continue;
        this.publishResult(condition.channelKey, res);
      }
    }
    catch (error) {
      console.error(`Error executing task '${this.channel}': ${error}`);
    }
    finally {
      this.isRunning = false;
    }
  }
}

