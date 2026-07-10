import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import type { FormEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { resolveEnrichment } from '~/api/enrichment'
import { saveRecently } from '~/data/resources/recently.mutations'
import { useI18n } from '~/i18n'
import type { RecentlyModel } from '~/models/recently'
import { ModalFooter, ModalHeader } from '~/ui/feedback/modal'
import { present, useModal } from '~/ui/feedback/modal-imperative'
import { Button } from '~/ui/primitives/button'
import { TextArea } from '~/ui/primitives/text-field'

import type { UrlPreviewState } from '../types/recently'
import { cleanErrorMessage, extractUrls } from '../utils/recently'
import { EnrichmentInlineCard } from './RecentlyPrimitives'

interface RecentlyEditorModalProps {
  item: RecentlyModel | null
}

function RecentlyEditorModal(props: RecentlyEditorModalProps) {
  const { t } = useI18n()
  const modal = useModal<boolean>()
  const previewGenerationRef = useRef(0)
  const [content, setContent] = useState(props.item?.content ?? '')
  const [detectedUrls, setDetectedUrls] = useState<string[]>([])
  const [error, setError] = useState('')
  const [previewStates, setPreviewStates] = useState<
    Record<string, UrlPreviewState>
  >({})
  const isEdit = Boolean(props.item?.id)

  useEffect(() => {
    const urls = extractUrls(content)
    setDetectedUrls(urls)
    setPreviewStates({})

    if (urls.length === 0) return

    const generation = ++previewGenerationRef.current
    const timer = window.setTimeout(() => {
      urls.forEach((url) => {
        setPreviewStates((current) => ({
          ...current,
          [url]: { error: null, loading: true, result: null },
        }))

        resolveEnrichment(url)
          .then((result) => {
            if (previewGenerationRef.current !== generation) return
            setPreviewStates((current) => ({
              ...current,
              [url]: { error: null, loading: false, result },
            }))
          })
          .catch((previewError: unknown) => {
            if (previewGenerationRef.current !== generation) return
            setPreviewStates((current) => ({
              ...current,
              [url]: {
                error:
                  previewError instanceof Error
                    ? previewError.message
                    : t('recently.error.parseFailed'),
                loading: false,
                result: null,
              },
            }))
          })
      })
    }, 500)

    return () => {
      window.clearTimeout(timer)
      previewGenerationRef.current += 1
    }
  }, [content])

  const mutation = useMutation({
    mutationFn: async () => {
      const data = { content: content.trim() }
      return saveRecently(
        props.item?.id
          ? { id: props.item.id, kind: 'edit' }
          : { kind: 'create' },
        data,
      )
    },
    onSuccess: () => {
      toast.success(t('recently.editor.saveSuccess'))
      modal.close(true)
    },
  })

  const handleSubmit = (event?: FormEvent) => {
    event?.preventDefault()

    if (!content.trim()) {
      setError(t('recently.editor.contentRequired'))
      return
    }

    setError('')
    mutation.mutate()
  }

  return (
    <form className="flex w-full flex-col" onSubmit={handleSubmit}>
      <ModalHeader
        title={
          isEdit
            ? t('recently.editor.editTitle')
            : t('recently.editor.createTitle')
        }
      />

      <div className="px-5 py-4">
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            {t('recently.editor.contentLabel')}{' '}
            <span className="text-red-500">*</span>
          </span>
          <TextArea
            autoFocus
            controlClassName="min-h-36"
            onChange={setContent}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                handleSubmit()
              }
            }}
            placeholder={t('recently.editor.placeholder')}
            required
            value={content}
          />
          {error ? <span className="text-xs text-red-500">{error}</span> : null}
        </label>

        {detectedUrls.length > 0 ? (
          <div className="mt-4 grid gap-2">
            {detectedUrls.map((url) => {
              const state = previewStates[url]

              return (
                <div className="grid gap-1.5" key={url}>
                  <div className="flex min-w-0 items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                    <span className="shrink-0">
                      {t('recently.editor.urlDetected')}
                    </span>
                    <code className="truncate rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs dark:bg-neutral-900">
                      {url}
                    </code>
                    {state?.loading ? (
                      <Loader2
                        aria-hidden="true"
                        className="size-3 shrink-0 animate-spin"
                      />
                    ) : null}
                  </div>

                  {state?.result ? (
                    <EnrichmentInlineCard enrichment={state.result} url={url} />
                  ) : null}

                  {state?.error && !state.loading ? (
                    <div className="rounded border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
                      <div className="font-medium text-neutral-700 dark:text-neutral-300">
                        {t('recently.editor.unidentifiedUrl')}
                      </div>
                      <div className="mt-0.5">
                        {cleanErrorMessage(state.error, t)}
                      </div>
                      <div className="mt-1 text-neutral-400">
                        {t('recently.editor.canSaveAnyway')}
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : null}
      </div>

      <ModalFooter>
        <span className="mr-auto text-xs text-fg-subtle">
          {t('recently.editor.shortcut')}
        </span>
        <Button onClick={() => modal.dismiss()} type="button" variant="subtle">
          {t('common.cancel')}
        </Button>
        <Button disabled={mutation.isPending} type="submit">
          {t('common.save')}
        </Button>
      </ModalFooter>
    </form>
  )
}

/**
 * Open the recently editor. Resolves with `true` on save success, `undefined` on dismiss.
 */
export async function presentRecentlyEditor(
  item: RecentlyModel | null,
): Promise<boolean | undefined> {
  const handle = present<RecentlyEditorModalProps, boolean>(
    RecentlyEditorModal,
    { item },
    {
      modalProps: { popupStyle: { width: 'min(92vw, 38rem)' } },
    },
  )
  return await handle
}
