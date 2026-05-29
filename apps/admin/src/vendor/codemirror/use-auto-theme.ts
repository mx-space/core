import { useEffect } from 'react'
import type { EditorView } from '@codemirror/view'

import { oneDark } from '@codemirror/theme-one-dark'
import { githubLight } from '@ddietr/codemirror-themes/theme/github-light'

import { useThemeMode } from '~/theme'

import { codemirrorReconfigureExtensionMap } from './extension'

export function useCodeMirrorAutoToggleTheme(
  view: EditorView | undefined,
): void {
  const { isDark } = useThemeMode()

  useEffect(() => {
    if (!view) return
    view.dispatch({
      effects: [
        codemirrorReconfigureExtensionMap.theme.reconfigure(
          isDark ? oneDark : githubLight,
        ),
      ],
    })
  }, [view, isDark])
}
