import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { SchedulerManager } from './SchedulerEmitter'

const app = new Hono()
app.use(cors())

app.get('/:channel', (c) => {
  const channel = c.req.param('channel')
  if (!channel) return c.json({ message: 'No channel provided' }, 400)

  const success = server.upgrade(c.req.raw, { data: { channel, queries: c.req.queries() } });
  if (success) return new Response(null);

  return c.json({ message: 'Redirecting...' })
})


const server = Bun.serve<{ channel: string; queries: Record<string, string[]> }>({
  fetch: app.fetch,
  port: 3000,
  websocket: {
    open(ws) {
      const { channel, queries } = ws.data;
      manager.onConnect(channel, queries, ws);
    },
    message(ws, message) {
      if (message === "ping") {
        ws.send("pong");
        return;
      }
    },
    close(ws) {
      const { channel, queries } = ws.data;
      manager.onDisconnect(channel, queries, ws);
    },
  }
});


import TimeTask from './tasks/time'
import { totalEvents } from './tasks/totalEvents'
import { comp7LastRecalculation } from './tasks/comp7LastRecalculation'
import { BattleResultTask } from './tasks/BattleResultTask'
import { Comp7InfoTask } from './tasks/Comp7InfoTask'

const EVERY_SECOND = '* * * * * *'

const manager = new SchedulerManager(server)
  .addSimpleTask('time', TimeTask, EVERY_SECOND, true)
  .addSimpleTask('totalEvents', totalEvents, EVERY_SECOND, true)
  .addSimpleTask('comp7LastRecalculation', comp7LastRecalculation, EVERY_SECOND, true)
  .addTask('battleResult', new BattleResultTask('battleResult', EVERY_SECOND))
  .addTask('comp7Info', new Comp7InfoTask('comp7Info', '* * * * * *'))

console.log(`WebSocket server running on ws://localhost:${server.port}`);
