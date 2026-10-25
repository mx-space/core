import type { LexicalEditor } from 'lexical'
import { lazy, Suspense, useEffect, useState } from 'react'

import { API_URL } from '~/constants/env'
import { RemoteCarets } from '~/features/write/components/collab/RemoteCarets'
import type { CrdtDraftController } from '~/features/write/crdt/use-crdt-draft'
import { useI18n } from '~/i18n'

const RichEditorBridge = lazy(() =>
  import('~/vendor/rich-editor').then((module) => ({
    default: module.RichEditorBridge,
  })),
)

const colorScheme = () =>
  document.documentElement.classList.contains('dark') ? 'dark' : 'light'

const refuseSnapshot = async (): Promise<string> => {
  throw new Error('Co-authors cannot upload drawings')
}

export function CoauthorEditor(props: {
  crdt: CrdtDraftController
  variant: 'article' | 'note'
}) {
  const { t } = useI18n()
  const [editor, setEditor] = useState<LexicalEditor | null>(null)
  const { bindEditor, locked } = props.crdt
  useEffect(() => {
    editor?.setEditable(!locked)
  }, [editor, locked])

  return (
    <>
      <Suspense
        fallback={
          <div className="h-32 animate-pulse rounded-md bg-surface-inset" />
        }
      >
        <RichEditorBridge
          apiUrl={API_URL}
          editorProps={{
            className: 'min-h-[60dvh] bg-transparent',
            contentClassName: 'min-h-[60dvh] px-0 pt-3 pb-[200px]',
            debounceMs: 250,
            placeholder: t('write.richEditor.placeholder'),
            theme: colorScheme(),
            variant: props.variant,
          }}
          onEditorReady={(next) => {
            setEditor(next)
            bindEditor(next)
          }}
          saveExcalidrawSnapshot={refuseSnapshot}
        />
      </Suspense>
      <RemoteCarets
        editor={editor}
        peers={props.crdt.peers}
        resolveCaret={props.crdt.resolveCaret}
      />
    </>
  )
}
