import { useMutation } from '@tanstack/react-query'
import { CircleAlert, Loader2, Upload } from 'lucide-react'
import type { FormEvent } from 'react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import type { DynamicCatalog } from '~/api/dynamic-components'
import {
  registerDynamicComponentEntry,
  updateDynamicComponentEntry,
} from '~/api/dynamic-components'
import { uploadFile } from '~/api/files'
import { ApiRequestError } from '~/api/http'
import { useI18n } from '~/i18n'
import { formatJson, parseJsonObject } from '~/lib/dynamic-props'
import { ModalFooter, ModalHeader } from '~/ui/feedback/modal'
import { present, useModal } from '~/ui/feedback/modal-imperative'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { TextArea, TextInput } from '~/ui/primitives/text-field'

import type { DynamicComponentItem } from '../types/dynamic-components'

const ERROR_KEYS = {
  DYNAMIC_COMPONENT_URL_CONFLICT: 'dynamicComponents.editor.error.urlConflict',
} as const

interface EditorProps {
  item: DynamicComponentItem | null
}

export interface DynamicComponentEditorResult {
  catalog: DynamicCatalog
  url: string
}

function DynamicComponentEditorModal({ item }: EditorProps) {
  const { t } = useI18n()
  const modal = useModal<DynamicComponentEditorResult>()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState(item?.name ?? '')
  const [url, setUrl] = useState(item?.url ?? '')
  const [initialHeight, setInitialHeight] = useState(
    String(item?.initialHeight ?? 240),
  )
  const [description, setDescription] = useState(item?.description ?? '')
  const [schemaText, setSchemaText] = useState(
    formatJson(item?.propsSchema ?? {}),
  )
  const [error, setError] = useState('')

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadFile(file, 'file', true),
    onError: () => setError(t('dynamicComponents.editor.uploadFailed')),
    onSuccess: (uploaded) => setUrl(uploaded.url),
  })

  const saveMutation = useMutation({
    mutationFn: async (entry: {
      description: string
      initialHeight: number
      name: string
      propsSchema: Record<string, unknown>
      url: string
    }) =>
      item
        ? updateDynamicComponentEntry(item.id, entry)
        : registerDynamicComponentEntry(entry),
    onError: (cause: unknown) => {
      const key =
        cause instanceof ApiRequestError
          ? ERROR_KEYS[cause.code as keyof typeof ERROR_KEYS]
          : undefined
      setError(
        key ? t(key) : cause instanceof Error ? cause.message : String(cause),
      )
    },
    onSuccess: (catalog, entry) => {
      toast.success(
        t(
          item
            ? 'dynamicComponents.toast.updated'
            : 'dynamicComponents.toast.created',
        ),
      )
      modal.close({ catalog, url: entry.url })
    },
  })

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const height = Number(initialHeight)
    const propsSchema = parseJsonObject(schemaText)
    const problem = !name.trim()
      ? 'dynamicComponents.editor.validate.nameRequired'
      : !url.trim()
        ? 'dynamicComponents.editor.validate.urlRequired'
        : !Number.isInteger(height) || height < 0 || height > 10_000
          ? 'dynamicComponents.editor.validate.heightInvalid'
          : null
    if (problem) {
      setError(t(problem))
      return
    }
    if (!propsSchema) {
      setError(t('dynamicComponents.editor.validate.schemaInvalid'))
      return
    }
    setError('')
    saveMutation.mutate({
      description: description.trim(),
      initialHeight: height,
      name: name.trim(),
      propsSchema,
      url: url.trim(),
    })
  }

  const busy = saveMutation.isPending || uploadMutation.isPending

  return (
    <form
      aria-busy={busy}
      className="flex h-[min(90svh,48rem)] min-h-0 flex-col"
      onSubmit={handleSubmit}
    >
      <ModalHeader
        title={t(
          item
            ? 'dynamicComponents.editor.editTitle'
            : 'dynamicComponents.editor.createTitle',
        )}
      />

      <Scroll className="flex-1" innerClassName="grid gap-5 px-5 py-5">
        <TextInput
          label={t('dynamicComponents.editor.name')}
          onChange={setName}
          placeholder="PriceTable"
          required
          value={name}
        />

        <div className="grid gap-1.5">
          <div className="flex items-end gap-2">
            <TextInput
              className="flex-1"
              controlClassName="font-mono text-xs"
              label={t('dynamicComponents.editor.url')}
              onChange={setUrl}
              placeholder="https://cdn.example.com/widget.js"
              required
              value={url}
            />
            <Button
              disabled={uploadMutation.isPending}
              onClick={() => fileInputRef.current?.click()}
              type="button"
              variant="secondary"
            >
              {uploadMutation.isPending ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <Upload aria-hidden="true" className="size-4" />
              )}
              {t(
                uploadMutation.isPending
                  ? 'dynamicComponents.editor.uploading'
                  : 'dynamicComponents.editor.upload',
              )}
            </Button>
            <input
              accept=".js,.mjs,text/javascript"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (!file) return
                setError('')
                uploadMutation.mutate(file)
              }}
              ref={fileInputRef}
              type="file"
            />
          </div>
          <p className="text-xs text-fg-muted">
            {t('dynamicComponents.editor.urlHint')}
          </p>
        </div>

        <TextInput
          inputMode="numeric"
          label={t('dynamicComponents.editor.initialHeight')}
          min={0}
          onChange={setInitialHeight}
          required
          type="number"
          value={initialHeight}
        />

        <div className="grid gap-1.5">
          <TextArea
            label={t('dynamicComponents.editor.description')}
            onChange={setDescription}
            value={description}
          />
          <p className="text-xs text-fg-muted">
            {t('dynamicComponents.editor.descriptionHint')}
          </p>
        </div>

        <TextArea
          controlClassName="min-h-48 font-mono text-xs leading-5"
          label={t('dynamicComponents.editor.propsSchema')}
          onChange={setSchemaText}
          spellCheck={false}
          value={schemaText}
        />
      </Scroll>

      {error ? (
        <div
          className="flex shrink-0 items-start gap-2 border-t border-red-500/20 bg-red-500/10 px-5 py-2.5 text-xs text-red-600 dark:text-red-400"
          role="alert"
        >
          <CircleAlert
            aria-hidden="true"
            className="mt-0.5 size-3.5 shrink-0"
          />
          <span className="min-w-0 break-words">{error}</span>
        </div>
      ) : null}

      <ModalFooter>
        <Button onClick={() => modal.dismiss()} type="button" variant="subtle">
          {t('common.cancel')}
        </Button>
        <Button disabled={busy} type="submit">
          {saveMutation.isPending ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : null}
          {t(
            saveMutation.isPending
              ? 'dynamicComponents.editor.saving'
              : item
                ? 'common.save'
                : 'common.create',
          )}
        </Button>
      </ModalFooter>
    </form>
  )
}

export async function presentDynamicComponentEditor(
  item: DynamicComponentItem | null,
): Promise<DynamicComponentEditorResult | undefined> {
  return await present<EditorProps, DynamicComponentEditorResult>(
    DynamicComponentEditorModal,
    { item },
    {
      modalProps: {
        className: 'max-h-[90svh]',
        popupStyle: { width: 'min(94vw, 40rem)' },
      },
    },
  )
}
