export interface DataJob {
  readonly id: string
  readonly description: string
  run: () => Promise<Record<string, any>>
}
