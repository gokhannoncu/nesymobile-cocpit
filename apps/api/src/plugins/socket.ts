import type { Server as HttpServer } from 'node:http'
import { Server } from 'socket.io'
import type { Env } from '../env.js'

export type AppSocketServer = Server

export function createSocketServer(httpServer: HttpServer, env: Env): AppSocketServer {
  const io = new Server(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN,
      methods: ['GET', 'POST'],
    },
  })

  io.on('connection', (socket) => {
    appLogger(socket.id, 'connected')

    socket.on('ping', () => {
      socket.emit('pong', { at: new Date().toISOString() })
    })

    socket.on('disconnect', () => {
      appLogger(socket.id, 'disconnected')
    })
  })

  return io
}

function appLogger(socketId: string, event: string) {
  console.log(`[socket.io] ${socketId} ${event}`)
}
