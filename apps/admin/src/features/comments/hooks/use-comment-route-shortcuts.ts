import { useEffect } from 'react'
import { tinykeys } from 'tinykeys'

import type { CommentTab } from '~/models/comment'

interface UseCommentRouteShortcutsDeps {
  navigateTab: (tab: CommentTab) => void
  focusSearch: () => void
  focusComposer: () => void
  /** Disable bindings — used to suppress shortcuts on phones. */
  enabled?: boolean
}

export function useCommentRouteShortcuts(deps: UseCommentRouteShortcutsDeps) {
  const { navigateTab, focusSearch, focusComposer, enabled = true } = deps
  useEffect(() => {
    if (!enabled) return
    if (typeof window === 'undefined') return
    return tinykeys(window, {
      'g u': () => navigateTab('unread'),
      'g r': () => navigateTab('read'),
      'g j': () => navigateTab('junk'),
      'g w': () => navigateTab('whispers'),
      'g a': () => navigateTab('awaiting'),
      'g l': () => navigateTab('all'),
      '/': (event) => {
        event.preventDefault()
        focusSearch()
      },
      r: () => focusComposer(),
    })
  }, [enabled, focusComposer, focusSearch, navigateTab])
}
