import { useMutation, useQuery } from '@tanstack/react-query'
import { Download, ExternalLink, Import, Loader2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { ImportFunctionPreview } from '../types/snippets'

import { importSnippets } from '~/api/snippets'
import { useI18n } from '~/i18n'
import { SnippetType } from '~/models/snippet'
import { adminQueryKeys } from '~/query/keys'
import { Button } from '~/ui/primitives/button'
import { TextInput } from '~/ui/primitives/text-field'

import {
  fetchAvailableSnippetPackages,
  loadSnippetPackage,
} from '../utils/snippet-packages'
import { basenameWithoutExt, getErrorMessage } from '../utils/snippets'
import { Field, InlineLoading, Modal } from './SnippetPrimitives'

export function ImportSnippetModal(props: {
  onClose: () => void
  onImported: (packages: string[]) => void
  open: boolean
}) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [processName, setProcessName] = useState('')
  const [functions, setFunctions] = useState<ImportFunctionPreview[]>([])
  const [dependencies, setDependencies] = useState<string[]>([])

  useEffect(() => {
    if (!props.open) {
      setName('')
      setProcessName('')
      setFunctions([])
      setDependencies([])
    }
  }, [props.open])

  const availableQuery = useQuery({
    enabled: props.open,
    queryFn: fetchAvailableSnippetPackages,
    queryKey: adminQueryKeys.snippets.githubPackages(),
  })

  const previewQuery = useQuery({
    enabled: props.open && Boolean(processName),
    queryFn: () => loadSnippetPackage(processName, t),
    queryKey: adminQueryKeys.snippets.githubPackage(processName),
  })

  useEffect(() => {
    if (!previewQuery.data) return
    setFunctions(previewQuery.data.functions)
    setDependencies(previewQuery.data.dependencies)
  }, [previewQuery.data])

  const importMutation = useMutation({
    mutationFn: () =>
      importSnippets({
        packages: dependencies,
        snippets: functions.map((item) => ({
          name: basenameWithoutExt(item.name),
          private: false,
          raw: item.raw,
          reference: item.reference,
          type: SnippetType.Function,
        })),
      }),
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('snippets.toast.importFailed'))),
    onSuccess: () => {
      toast.success(t('snippets.toast.importSuccess'))
      props.onImported(dependencies)
      props.onClose()
    },
  })

  const startProcess = () => {
    const nextName = name.trim()
    if (!nextName) {
      toast.error(t('snippets.toast.packageNameRequired'))
      return
    }
    setProcessName(nextName)
  }

  return (
    <Modal
      onClose={props.onClose}
      open={props.open}
      title={t('snippets.dialog.import.title')}
    >
      <div className="space-y-5">
        <div className="grid gap-3">
          <Field label={t('snippets.dialog.import.fieldName')}>
            <TextInput
              onChange={setName}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  startProcess()
                }
              }}
              placeholder={t('snippets.dialog.import.placeholder')}
              value={name}
            />
          </Field>
          <div className="flex justify-end">
            <Button onClick={startProcess} type="button">
              <Download aria-hidden="true" className="size-4" />
              {t('snippets.dialog.import.process')}
            </Button>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium">
            {t('snippets.dialog.import.available')}
          </h3>
          <div className="mt-2 min-h-10">
            {availableQuery.isLoading ? (
              <InlineLoading label={t('snippets.dialog.import.fetching')} />
            ) : availableQuery.data?.length ? (
              <div className="flex flex-wrap gap-2">
                {availableQuery.data.map((item) => (
                  <span
                    className="inline-flex items-center gap-1 rounded border border-neutral-200 text-sm dark:border-neutral-800"
                    key={item.name}
                  >
                    <button
                      className="px-2 py-1 text-neutral-700 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-neutral-900"
                      onClick={() => {
                        setName(item.name)
                        setProcessName(item.name)
                      }}
                      type="button"
                    >
                      {item.name}
                    </button>
                    {item.url ? (
                      <a
                        className="pr-2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-100"
                        href={item.url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <ExternalLink aria-hidden="true" className="size-3.5" />
                      </a>
                    ) : null}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-500">
                {t('snippets.dialog.import.noAvailable')}
              </p>
            )}
          </div>
        </div>

        {processName ? (
          <div className="rounded border border-neutral-200 dark:border-neutral-800">
            <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
              <h3 className="text-sm font-medium">
                {t('snippets.dialog.import.resultTitle', { name: processName })}
              </h3>
            </div>
            <div className="space-y-4 p-4">
              {previewQuery.isLoading ? (
                <InlineLoading label={t('snippets.dialog.import.parsing')} />
              ) : previewQuery.isError ? (
                <p className="text-sm text-red-600">
                  {getErrorMessage(
                    previewQuery.error,
                    t('snippets.dialog.import.parseFailed'),
                  )}
                </p>
              ) : (
                <>
                  <PreviewTagList
                    items={functions}
                    label={t('snippets.dialog.import.functions')}
                    onRemove={(index) =>
                      setFunctions((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                    render={(item) => item.name}
                  />
                  <PreviewTagList
                    items={dependencies}
                    label={t('snippets.dialog.import.dependencies')}
                    onRemove={(index) =>
                      setDependencies((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                    render={(item) => item}
                  />
                  <div className="flex justify-end">
                    <Button
                      disabled={
                        importMutation.isPending || functions.length === 0
                      }
                      onClick={() => importMutation.mutate()}
                      type="button"
                    >
                      {importMutation.isPending ? (
                        <Loader2
                          aria-hidden="true"
                          className="size-4 animate-spin"
                        />
                      ) : (
                        <Import aria-hidden="true" className="size-4" />
                      )}
                      {t('snippets.dialog.import.submit')}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}

function PreviewTagList<TItem>(props: {
  items: TItem[]
  label: string
  onRemove: (index: number) => void
  render: (item: TItem) => string
}) {
  const { t } = useI18n()
  return (
    <div>
      <h4 className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
        {props.label}
      </h4>
      <div className="mt-2 flex flex-wrap gap-2">
        {props.items.length === 0 ? (
          <span className="text-sm text-neutral-400">
            {t('snippets.dialog.import.none')}
          </span>
        ) : (
          props.items.map((item, index) => (
            <span
              className="inline-flex items-center gap-1 rounded bg-neutral-100 px-2 py-1 text-xs text-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
              key={`${props.render(item)}-${index}`}
            >
              {props.render(item)}
              <button
                className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-100"
                onClick={() => props.onRemove(index)}
                type="button"
              >
                <X aria-hidden="true" className="size-3" />
              </button>
            </span>
          ))
        )}
      </div>
    </div>
  )
}
