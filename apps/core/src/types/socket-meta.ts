// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SocketMetadata {}

declare module 'socket.io' {
  interface Socket {
    // @ts-expect-error
    data: SocketMetadata
  }
}
