export interface DiffStrategy {
  createPatch: (base: string, current: string) => string
  applyPatch: (base: string, patch: string) => string
  isOversized: (patch: string, original: string, threshold: number) => boolean
}
