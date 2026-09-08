import type { ToolCallGroupItem } from '@haklex/rich-agent-core'
import { ColorSchemeProvider } from '@haklex/rich-editor/static'
import { DynamicHostRenderer } from '@haklex/rich-ext-dynamic'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { useI18n } from '~/i18n'
import { useThemeMode } from '~/theme'
import { Modal, ModalHeader } from '~/ui/feedback/modal'
import { Button } from '~/ui/primitives/button'
import type { DynamicDraft } from '~/vendor/rich-editor/utils/dynamic-tools'
import {
  readDynamicDraft,
  readDynamicReceipt,
} from '~/vendor/rich-editor/utils/dynamic-tools'

function ComponentPreview({ draft }: { draft: DynamicDraft }) {
  const { isDark } = useThemeMode()
  const [url, setUrl] = useState('')
  useEffect(() => {
    const next = URL.createObjectURL(
      new Blob([draft.source], { type: 'text/javascript' }),
    )
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [draft.source])
  return url ? (
    <ColorSchemeProvider colorScheme={isDark ? 'dark' : 'light'}>
      <DynamicHostRenderer
        url={url}
        componentProps={draft.props}
        initialHeight={draft.initialHeight}
      />
    </ColorSchemeProvider>
  ) : null
}

export function DynamicComponentCard({
  item,
  disabled,
  onPublish,
}: {
  item: ToolCallGroupItem
  disabled: boolean
  onPublish: (item: ToolCallGroupItem) => Promise<void>
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState('')
  const draft = readDynamicDraft(item)
  if (!draft) return null
  const { inserted } = readDynamicReceipt(item)

  const publish = async () => {
    setPublishing(true)
    setError('')
    try {
      await onPublish(item)
      setOpen(false)
      toast.success(
        t(
          draft.target
            ? 'write.agent.dynamic.updated'
            : 'write.agent.dynamic.inserted',
        ),
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setPublishing(false)
    }
  }

  const actions = (
    <div className="flex flex-wrap gap-2">
      {!open ? (
        <Button type="button" variant="subtle" onClick={() => setOpen(true)}>
          {t('write.agent.dynamic.preview')}
        </Button>
      ) : null}
      <Button
        type="button"
        disabled={disabled || publishing || inserted}
        onClick={() => void publish()}
      >
        {inserted
          ? t(
              draft.target
                ? 'write.agent.dynamic.updated'
                : 'write.agent.dynamic.inserted',
            )
          : publishing
            ? t('write.agent.dynamic.uploading')
            : t(
                draft.target
                  ? 'write.agent.dynamic.replace'
                  : 'write.agent.dynamic.publish',
              )}
      </Button>
    </div>
  )

  return (
    <>
      <div className="space-y-2 rounded-md border border-border bg-surface-inset p-3">
        <div className="text-sm font-medium text-fg">{draft.name}</div>
        <p className="text-xs text-fg-muted">
          {t(
            draft.target
              ? 'write.agent.dynamic.versionHint'
              : 'write.agent.dynamic.hint',
          )}
        </p>
        {actions}
        {error ? (
          <p role="alert" className="text-xs text-red-600">
            {error}
          </p>
        ) : null}
      </div>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        className="w-[min(960px,calc(100vw-2rem))] max-w-none"
      >
        <ModalHeader title={draft.name} />
        <div className="max-h-[75vh] space-y-4 overflow-auto p-4">
          {open ? <ComponentPreview draft={draft} /> : null}
          <details className="text-xs text-fg-muted">
            <summary className="cursor-pointer">
              {t('write.agent.dynamic.source')}
            </summary>
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded bg-surface-inset p-3">
              {draft.source}
            </pre>
          </details>
          {actions}
          {error ? (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          ) : null}
        </div>
      </Modal>
    </>
  )
}
