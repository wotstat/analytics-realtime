import nodeCron from "node-cron"


export class SchedulerManager {

  private tasks = new Map<string, SchedulerEmitter<any>>();

  constructor(private readonly server: Bun.Server) {
  }

  addTask(channel: string, task: () => any, cron: string, sendCurrentStateOnConnection: boolean = false) {
    this.tasks.set(channel, new SchedulerEmitter(channel,
      task,
      cron,
      (d: any) => this.sendToChannel(channel, d),
      sendCurrentStateOnConnection))
    return this
  }

  onConnect(channel: string, client: Bun.ServerWebSocket<any>) {
    const task = this.tasks.get(channel)
    if (!task) return

    if (task.sendCurrentStateOnConnection && task.currentState) {
      client.send(JSON.stringify(task.currentState));
    }
  }

  private sendToChannel(channel: string, data: any) {
    this.server.publish(channel, JSON.stringify(data));
  }
}

export class SchedulerEmitter<T> {

  currentState: T | null = null;

  private isRunning = false;

  constructor(
    private readonly channel: string,
    private readonly task: () => Promise<T>,
    cron: string,
    private readonly publish: (d: T) => void,
    public readonly sendCurrentStateOnConnection: boolean = false) {
    nodeCron.schedule(cron, () => this.executeTask());

    const delay = Math.floor(Math.random() * 10000);
    console.log(`Scheduled task '${channel}' with cron: ${cron}. Starting in ${delay}ms...`);
    setTimeout(() => this.executeTask(), delay);
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