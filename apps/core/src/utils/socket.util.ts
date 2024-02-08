import type { Socket } from 'socket.io'

const symbolKey = Symbol('meta')

export interface SocketMetadata {}

export const setSocketMetadata = (socket: Socket, value: object) => {
  const existValue = getSocketMetadata(socket)
  Reflect.set(socket.client, symbolKey, {
    ...existValue,
    ...value,
  })
}

export const getSocketMetadata = (socket: Socket): SocketMetadata => {
  return Reflect.get(socket.client, symbolKey)
}
