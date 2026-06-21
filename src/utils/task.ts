import nodeCron from "node-cron"
import { HashMap, type Hashable } from "./HashSet";

export class BaseTask {

  protected server: Bun.Server<unknown> | null = null;

  constructor(readonly channel: string) {
  }

  setup(server: Bun.Server<unknown>) {
    this.server = server;
    return this
  }

  onConnect(queries: Record<string, string[]>, client: Bun.ServerWebSocket<any>) {
    client.subscribe(this.channel);
  }

  onDisconnect(queries: Record<string, string[]>, client: Bun.ServerWebSocket<any>) {
    client.unsubscribe(this.channel);
  }

  publish(data: any) {
    this.server?.publish(this.channel, JSON.stringify(data));
  }
}

export class SimpleTask<T> extends BaseTask {
  private currentState: T | null = null;
  private isRunning = false;

  constructor(channel: string,
    private readonly task: () => Promise<T>,
    cron: string,
    private readonly sendCurrentStateOnConnection: boolean = false) {

    super(channel);

    nodeCron.schedule(cron, () => this.executeTask());

    const delay = Math.floor(Math.random() * 10000);
    console.log(`Scheduled task '${channel}' with cron: ${cron}. Starting in ${delay}ms...`);
    setTimeout(() => this.executeTask(), delay);
  }

  override onConnect(queries: Record<string, string[]>, client: Bun.ServerWebSocket<any>): void {
    super.onConnect(queries, client);
    if (this.sendCurrentStateOnConnection && this.currentState) {
      client.send(JSON.stringify(this.currentState));
    }
  }

  private async executeTask() {
    if (this.isRunning) return;

    this.isRunning = true;

    try {
      const result = await this.task()
      this.currentState = result;
      this.publish(result);
    } catch (error) { console.error(`Error executing task '${this.channel}': ${error}`); }

    this.isRunning = false;
  }
}

export interface Conditional<T> extends Hashable {
  check(data: T): boolean;
  channelKey: string;
}

export class BaseCondition<D> implements Conditional<D> {
  constructor(public readonly channelKey: string) { }

  check(data: D): boolean {
    return true;
  }

  hash(): string {
    return this.channelKey;
  }
}

export class RecordCondition<T> extends BaseCondition<T> {
  constructor(channelKey: string, readonly fields: Partial<T>) {
    super(channelKey);
  }

  override check(data: T): boolean {
    for (const key in this.fields) {
      if (this.fields[key] !== undefined && this.fields[key] !== data[key]) {
        return false;
      }
    }
    return true;
  }
}

export abstract class TableChangeTask<Ctx, D, Condition extends Conditional<D>> extends BaseTask {
  protected activeChannel = new HashMap<Condition, number>()
  private isRunning = false;

  constructor(channel: string, cron: string = '* * * * * *') {
    super(channel);

    nodeCron.schedule(cron, () => this.executeTask());

    const delay = Math.floor(Math.random() * 10000);
    console.log(`Scheduled task '${channel}' with cron: ${cron}. Starting in ${delay}ms...`);
    setTimeout(() => this.executeTask(), delay);
  }

  abstract parseQueries(queries: Record<string, string[]>): Ctx
  abstract getChannelKey(ctx: Ctx): string
  abstract createCondition(ctx: Ctx): Condition
  abstract loadData(): Promise<D[]>

  override onConnect(queries: Record<string, string[]>, client: Bun.ServerWebSocket<any>): void {
    const ctx = this.parseQueries(queries);
    const key = this.getChannelKey(ctx);
    client.subscribe(key);

    const condition = this.createCondition(ctx);
    const count = this.activeChannel.get(condition) || 0;
    this.activeChannel.set(condition, count + 1);
  }

  override onDisconnect(queries: Record<string, string[]>, client: Bun.ServerWebSocket<any>): void {
    const ctx = this.parseQueries(queries);
    const key = this.getChannelKey(ctx);
    client.unsubscribe(key);

    const condition = this.createCondition(ctx);
    const count = this.activeChannel.get(condition) || 0;
    this.activeChannel.set(condition, count - 1);
  }

  publishChanges(channel: string, data: any): void {
    this.server?.publish(channel, JSON.stringify(data));
  }

  private async executeTask() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {

      const result = await this.loadData();

      if (result.length === 0) return;

      for (const [condition, count] of this.activeChannel.entries()) {
        if (count <= 0) {
          this.activeChannel.delete(condition);
          continue;
        }

        const res = result.filter(condition.check.bind(condition));
        if (res.length === 0) continue;
        this.publishChanges(condition.channelKey, res);
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