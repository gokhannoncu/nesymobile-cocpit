/**
 * Manual smoke test for the run live stream.
 *
 * Usage: node apps/web/scripts/run-live-smoke.mjs <runId> [seconds]
 *
 * Subscribes exactly like the run detail page does and prints whatever arrives.
 * Exists because "the page is not moving" has two sides — producer and socket —
 * and this one checks the socket half without a browser in the way.
 */
import { io } from 'socket.io-client'

const runId = process.argv[2]
const seconds = Number(process.argv[3] ?? 10)
if (!runId) {
  console.error('usage: node run-live-smoke.mjs <runId> [seconds]')
  process.exit(1)
}

const socket = io(process.env.API_ORIGIN ?? 'http://localhost:4001', {
  transports: ['websocket', 'polling'],
})

socket.on('connect', () => {
  console.log('[smoke] connected', socket.id)
  socket.emit('run:subscribe', { runId, afterSeq: 0 })
})
socket.on('run:subscribed', (payload) => {
  console.log(`[smoke] subscribed latestSeq=${payload.latestSeq} replay=${payload.events.length}`)
  for (const event of payload.events) {
    console.log(`  replay #${event.seq} ${event.kind}/${event.level} ${event.title}`)
  }
})
socket.on('run:event', (event) => {
  console.log(`[smoke] live #${event.seq} ${event.kind}/${event.level} ${event.title}`)
})
socket.on('run:error', (error) => console.log('[smoke] error', error))
socket.on('connect_error', (error) => console.log('[smoke] connect_error', error.message))

setTimeout(() => {
  socket.emit('run:unsubscribe', { runId })
  socket.disconnect()
  process.exit(0)
}, seconds * 1000)
