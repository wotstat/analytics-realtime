import nodeCron from "node-cron"


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

export class SchedulerManager {

  private tasks = new Map<string, BaseTask>();

  constructor(private readonly server: Bun.Server<unknown>) { }

  addSimpleTask(channel: string, task: () => any, cron: string, sendCurrentStateOnConnection: boolean = false) {
    const emitter = new SimpleTask(channel, task, cron, sendCurrentStateOnConnection);
    this.addTask(channel, emitter)
    return this
  }

  addTask(channel: string, task: BaseTask) {
    this.tasks.set(channel, task.setup(this.server))
    return this
  }

  onConnect(channel: string, queries: Record<string, string[]>, client: Bun.ServerWebSocket<any>) {
    const task = this.tasks.get(channel)
    if (!task) return

    task.onConnect(queries, client)
  }

  onDisconnect(channel: string, queries: Record<string, string[]>, client: Bun.ServerWebSocket<any>) {
    const task = this.tasks.get(channel)
    if (!task) return

    task.onDisconnect(queries, client)
  }
}
