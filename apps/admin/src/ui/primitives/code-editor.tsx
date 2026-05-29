import Editor, { loader } from '@monaco-editor/react'
import { AlertCircle, CheckCircle2, Code2, Loader2, Save } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import * as monaco from 'monaco-editor'
import type { OnMount } from '@monaco-editor/react'

import { useI18n } from '~/i18n'
import { useThemeMode } from '~/theme'
import { cn } from '~/utils/cn'

import {
  ensureGithubThemesRegistered,
  GITHUB_DARK_THEME,
  GITHUB_LIGHT_THEME,
} from './code-editor-themes'

loader.config({ monaco })

export interface CodeEditorProps {
  className?: string
  dirty?: boolean
  language: string
  onChange: (value: string) => void
  onSave?: () => void
  saving?: boolean
  title?: string
  value: string
}

export function CodeEditor({
  className,
  dirty,
  language,
  onChange,
  onSave,
  saving,
  title,
  value,
}: CodeEditorProps) {
  const { t } = useI18n()
  const { isDark } = useThemeMode()
  const lineCount = useMemo(
    () => (value ? value.split('\n').length : 1),
    [value],
  )

  useEffect(() => {
    ensureGithubThemesRegistered()
  }, [])

  const resolvedTheme = isDark ? GITHUB_DARK_THEME : GITHUB_LIGHT_THEME

  const handleMount: OnMount = (editor, monacoInstance) => {
    if (!onSave) return

    editor.addCommand(
      monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS,
      () => onSave(),
    )
  }

  return (
    <div
      className={cn(
        'flex h-full min-h-0 flex-col bg-white text-neutral-900 dark:bg-[#0d1117] dark:text-neutral-100',
        className,
      )}
    >
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-neutral-200 px-4 text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
        <div className="flex min-w-0 items-center gap-2">
          <Code2 aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="truncate font-medium uppercase">
            {title ?? language}
          </span>
          {onSave ? (
            <span className="hidden text-neutral-600 sm:inline">
              Cmd/Ctrl+S
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span>{lineCount} lines</span>
          {saving ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 aria-hidden="true" className="size-3 animate-spin" />
              Saving
            </span>
          ) : dirty === undefined ? null : dirty ? (
            <span className="inline-flex items-center gap-1">
              <AlertCircle aria-hidden="true" className="size-3" />
              Modified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 aria-hidden="true" className="size-3" />
              Saved
            </span>
          )}
          {onSave ? (
            <button
              aria-label={t('ui.codeEditor.saveAria')}
              className="inline-flex size-6 items-center justify-center rounded text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
              onClick={onSave}
              type="button"
            >
              <Save aria-hidden="true" className="size-3.5" />
            </button>
          ) : null}
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <Editor
          height="100%"
          language={language}
          loading={
            <div className="flex h-full items-center justify-center text-xs text-neutral-500">
              {t('ui.codeEditor.loadingMonaco')}
            </div>
          }
          onChange={(nextValue) => onChange(nextValue ?? '')}
          onMount={handleMount}
          options={{
            automaticLayout: true,
            contextmenu: true,
            fontFamily:
              'JetBrains Mono, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
            fontSize: 12,
            lineHeight: 20,
            minimap: { enabled: false },
            padding: { bottom: 16, top: 16 },
            scrollBeyondLastLine: false,
            tabSize: 2,
            wordWrap: 'on',
          }}
          theme={resolvedTheme}
          value={value}
        />
      </div>
    </div>
  )
}
