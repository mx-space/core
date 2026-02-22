import DiffMatchPatch from 'diff-match-patch'
import type { DiffStrategy } from './diff-strategy.interface'

const dmp = new DiffMatchPatch()

export const textDiffStrategy: DiffStrategy = {
  createPatch(base: string, current: string): string {
    const patches = dmp.patch_make(base, current)
    return dmp.patch_toText(patches)
  },

  applyPatch(base: string, patch: string): string {
    try {
      const patches = dmp.patch_fromText(patch)
      const [result, flags] = dmp.patch_apply(patches, base)
      return flags.every((f) => f) ? result : base
    } catch {
      return base
    }
  },

  isOversized(patch: string, original: string, threshold: number): boolean {
    return patch.length > original.length * threshold
  },
}
