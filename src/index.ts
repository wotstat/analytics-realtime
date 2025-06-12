import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { SchedulerManager } from './SchedulerEmitter'

const app = new Hono()
app.use(cors())

app.get('/:channel', (c) => {
  const channel = c.req.param('channel')
  if (!channel) return c.json({ message: 'No channel provided' }, 400)

  const success = server.upgrade(c.req.raw, { data: { channel } });
  if (success) return new Response(null);

  return c.json({ message: 'Redirecting...' })
})


const server = Bun.serve<{ channel: string }, {}>({
  fetch: app.fetch,
  port: 3000,
  websocket: {
    open(ws) {
      const { channel } = ws.data;
      manager.onConnect(channel, ws);
      ws.subscribe(channel);
    },
    message(ws, message) {
      if (message === "ping") {
        ws.send("pong");
        return;
      }
    },
    close(ws) {
      const { channel } = ws.data;
      ws.unsubscribe(channel);
    },
  }
});


import TimeTask from './tasks/time'
import { totalEvents } from './tasks/totalEvents'
const manager = new SchedulerManager(server)
  .addTask('time', TimeTask, '* * * * * *', true)
  .addTask('totalEvents', totalEvents, '* * * * * *', true);

console.log(`WebSocket server running on ws://localhost:${server.port}`);
