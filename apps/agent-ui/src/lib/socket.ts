import { io, type Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io('/admin', {
      transports: ['websocket'],
      withCredentials: true,
      autoConnect: false,
    })
  }
  return socket
}

export function connectSocket() {
  const s = getSocket()
  if (!s.connected) {
    s.connect()
  }
}

export function disconnectSocket() {
  if (socket?.connected) {
    socket.disconnect()
  }
}

export function joinSession(sessionId: string) {
  const s = getSocket()
  s.emit('ai-agent:join', { sessionId })
}

export function leaveSession(sessionId: string) {
  const s = getSocket()
  s.emit('ai-agent:leave', { sessionId })
}

export function onWsMessage(handler: (data: unknown) => void): () => void {
  const s = getSocket()
  s.on('message', handler)
  return () => {
    s.off('message', handler)
  }
}
