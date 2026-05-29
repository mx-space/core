import type { UpdateRepo } from '~/api/github-update'

export interface ReleaseModalState {
  repo: UpdateRepo
  title: string
  version: string
}

export type ClosedUpdateTipKey = 'dashboard' | 'system'

export interface ClosedUpdateTips {
  dashboard: null | string
  system: null | string
}

export interface SearchIndexRebuildStats {
  created: number
  deleted: number
  skipped: number
  total: number
  updated: number
}
