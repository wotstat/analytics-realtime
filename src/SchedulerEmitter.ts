import { SimpleTask, type BaseTask } from "./utils/task";

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
