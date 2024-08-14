export interface SocketMetadata {}

declare module 'socket.io' {
  interface Socket {
    // @ts-expect-error
    data: SocketMetadata
  }
}
