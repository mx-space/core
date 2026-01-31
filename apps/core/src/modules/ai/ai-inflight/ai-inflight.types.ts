export type AiStreamEvent =
  | { type: 'token'; data: string }
  | { type: 'done'; data: { resultId: string } }
  | { type: 'error'; data: { message: string } }

export interface AiInFlightOptions<T> {
  key: string
  lockTtlSec: number
  resultTtlSec: number
  streamMaxLen: number
  readBlockMs: number
  idleTimeoutMs: number
  onLeader: (ctx: {
    push: (event: AiStreamEvent) => Promise<void>
  }) => Promise<{ result: T; resultId: string }>
  parseResult: (resultId: string) => Promise<T>
}
