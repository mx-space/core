import { create } from 'jsondiffpatch'
import type { DiffStrategy } from './diff-strategy.interface'

const diffpatcher = create({
  objectHash: (obj: any) => obj.id ?? obj.type ?? JSON.stringify(obj),
})

export const jsonDiffStrategy: DiffStrategy = {
  createPatch(base: string, current: string): string {
    try {
      const left = JSON.parse(base)
      const right = JSON.parse(current)
      const delta = diffpatcher.diff(left, right)
      if (!delta) return ''
      return JSON.stringify(delta)
    } catch {
      return ''
    }
  },

  applyPatch(base: string, patch: string): string {
    try {
      const left = structuredClone(JSON.parse(base))
      const delta = JSON.parse(patch)
      const result = diffpatcher.patch(left, delta)
      return JSON.stringify(result)
    } catch {
      return base
    }
  },

  isOversized(patch: string, original: string, threshold: number): boolean {
    return patch.length > original.length * threshold
  },
}
