import { act, createElement } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { I18nProvider } from '~/i18n'

import { CodeEditor } from './code-editor'

let saveShortcut: (() => void) | undefined

vi.mock('monaco-editor', () => ({}))
vi.mock('~/theme', () => ({ useThemeMode: () => ({ isDark: false }) }))
vi.mock('./code-editor-themes', () => ({
  ensureGithubThemesRegistered: () => {},
  GITHUB_DARK_THEME: 'dark',
  GITHUB_LIGHT_THEME: 'light',
}))
vi.mock('@monaco-editor/react', async () => {
  const { useEffect } = await import('react')
  return {
    loader: { config: () => {} },
    default: (props: {
      onMount?: (editor: unknown, monaco: unknown) => void
    }) => {
      useEffect(() => {
        props.onMount?.(
          {
            addCommand: (_keys: number, run: () => void) => {
              saveShortcut = run
            },
          },
          { KeyCode: { KeyS: 1 }, KeyMod: { CtrlCmd: 2 } },
        )
      }, [])
      return null
    },
  }
})

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  saveShortcut = undefined
  container = document.createElement('div')
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
})

function render(onSave: () => void) {
  act(() => {
    root.render(
      createElement(
        I18nProvider,
        null,
        createElement(CodeEditor, {
          language: 'javascript',
          onChange: () => {},
          onSave,
          value: '',
        }),
      ),
    )
  })
}

it('runs the latest onSave from the save shortcut after re-renders', () => {
  const first = vi.fn()
  const latest = vi.fn()
  render(first)
  render(latest)

  act(() => saveShortcut?.())

  expect(first).not.toHaveBeenCalled()
  expect(latest).toHaveBeenCalledTimes(1)
})
