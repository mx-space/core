import type { Socket } from 'socket.io'

const symbolKey = Symbol('meta')
export const setSocketMetadata = (socket: Socket, value: object) => {
  const existValue = getSocketMetadata(socket)
  Reflect.set(socket.client, symbolKey, {
    ...existValue,
    ...value,
  })
}

export const getSocketMetadata = (socket: Socket) => {
  return Reflect.get(socket.client, symbolKey)
}
