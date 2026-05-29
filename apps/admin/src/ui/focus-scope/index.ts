export { FocusScope } from './FocusScope'
export type { FocusScopeProps } from './FocusScope'
export {
  getActiveScopeId,
  registerFocusScope,
  setActiveScope,
  useActiveFocusScopeId,
  useFocusScopeActive,
} from './hooks'
export type { FocusScopeStore } from './store'
export { getFocusScopeStoreState, useFocusScopeStore } from './store'
export { useScopeArrowNav } from './use-scope-arrow-nav'
export type { UseScopeArrowNavOptions } from './use-scope-arrow-nav'

/**
 * Shell-level focus scope ids. Page-level scopes (e.g. `'posts-list'`,
 * `'notes-list'`) stay in their owning views.
 */
export const FOCUS_SCOPES = {
  sidebar: 'sidebar',
} as const

export type ShellFocusScopeId = (typeof FOCUS_SCOPES)[keyof typeof FOCUS_SCOPES]
