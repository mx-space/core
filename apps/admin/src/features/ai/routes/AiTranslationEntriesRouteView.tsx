import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpenText, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { useEffect, useLayoutEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import type { TranslationEntry, TranslationEntryKeyPath } from '~/api/ai'

import {
  deleteTranslationEntry,
  generateTranslationEntries,
  getTranslationEntries,
  updateTranslationEntry,
} from '~/api/ai'
import { ContentListHeader } from '~/features/_shared/components/content-list-toolbar'
import { useI18n } from '~/i18n'
import { CompactPagination } from '~/ui/data/compact-pagination'
import { confirmDialog } from '~/ui/feedback/confirm'
import { FocusScope } from '~/ui/focus-scope'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { SelectField } from '~/ui/primitives/select'
import { TextInput } from '~/ui/primitives/text-field'
import { cn } from '~/utils/cn'

import { Code, SmallBadge } from '../components/AiPrimitives'
import {
  GroupedResourceSkeleton,
  ResourceEmpty,
  ResourceError,
} from '../components/GroupedResourceStates'
import { translationEntryKeyPathOptions } from '../constants'
import { getErrorMessage } from '../utils/ai'

const FOCUS_SCOPE_ID = 'ai-translation-entries'
const PAGE_SIZE = 50

function readPositiveInt(value: null | string) {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : 1
}

function isKeyPath(value: string): value is TranslationEntryKeyPath {
  return (translationEntryKeyPathOptions as readonly string[]).includes(value)
}

export function AiTranslationEntriesRouteView() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const searchParamsKey = searchParams.toString()

  const [page, setPage] = useState(readPositiveInt(searchParams.get('page')))
  const [keyPath, setKeyPath] = useState<TranslationEntryKeyPath | ''>(() => {
    const v = searchParams.get('keyPath') ?? ''
    return v && isKeyPath(v) ? v : ''
  })
  const [lang, setLang] = useState(searchParams.get('lang') ?? '')

  useLayoutEffect(() => {
    const nextPage = readPositiveInt(searchParams.get('page'))
    const rawKeyPath = searchParams.get('keyPath') ?? ''
    const nextKeyPath = rawKeyPath && isKeyPath(rawKeyPath) ? rawKeyPath : ''
    const nextLang = searchParams.get('lang') ?? ''
    setPage((v) => (v === nextPage ? v : nextPage))
    setKeyPath((v) => (v === nextKeyPath ? v : nextKeyPath))
    setLang((v) => (v === nextLang ? v : nextLang))
  }, [searchParamsKey])

  useEffect(() => {
    const next = new URLSearchParams()
    if (page > 1) next.set('page', String(page))
    if (keyPath) next.set('keyPath', keyPath)
    if (lang) next.set('lang', lang)
    if (next.toString() !== searchParamsKey) {
      setSearchParams(next, { replace: true })
    }
  }, [keyPath, lang, page, searchParamsKey, setSearchParams])

  const params = {
    keyPath: keyPath || undefined,
    lang: lang.trim() || undefined,
    page,
    size: PAGE_SIZE,
  }

  const query = useQuery({
    placeholderData: (previous) => previous,
    queryFn: () => getTranslationEntries(params),
    queryKey: ['ai', 'translation-entries', params],
  })

  const entries = query.data?.data ?? []
  const total = query.data?.pagination.total ?? entries.length
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const invalidate = async () => {
    await queryClient.invalidateQueries({
      queryKey: ['ai', 'translation-entries'],
    })
  }

  const generateMutation = useMutation({
    mutationFn: () => generateTranslationEntries(),
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('ai.toast.entryGenerateFailed'))),
    onSuccess: async (result) => {
      toast.success(
        t('ai.toast.entryGenerated', {
          created: result.created,
          skipped: result.skipped,
        }),
      )
      await invalidate()
    },
  })

  const updateMutation = useMutation({
    mutationFn: (entry: TranslationEntry) => {
      const translatedText = window.prompt(
        t('ai.edit.translatedTextPrompt'),
        entry.translatedText,
      )
      if (translatedText === null) return Promise.resolve(entry)

      return updateTranslationEntry(entry.id, { translatedText })
    },
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('ai.toast.entrySaveFailed'))),
    onSuccess: async () => {
      toast.success(t('ai.toast.entrySaved'))
      await invalidate()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteTranslationEntry,
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('ai.toast.entryDeleteFailed'))),
    onSuccess: async () => {
      toast.success(t('ai.toast.entryDeleted'))
      await invalidate()
    },
  })

  const confirmAndDelete = async (entry: TranslationEntry) => {
    const ok = await confirmDialog({
      destructive: true,
      title: t('ai.confirm.deleteEntry'),
    })
    if (ok) deleteMutation.mutate(entry.id)
  }

  const keyPathOptions = [
    { label: t('ai.filter.allKeyPath'), value: '' },
    ...translationEntryKeyPathOptions.map((option) => ({
      label: option,
      value: option,
    })),
  ]

  return (
    <FocusScope
      className="outline-hidden flex h-full min-h-0 flex-col bg-white dark:bg-neutral-950"
      id={FOCUS_SCOPE_ID}
    >
      <ContentListHeader
        action={
          <Button
            disabled={generateMutation.isPending}
            onClick={() => generateMutation.mutate()}
            type="button"
            variant="primary"
          >
            {generateMutation.isPending ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Sparkles aria-hidden="true" className="size-4" />
            )}
            {t('ai.action.generateEntries')}
          </Button>
        }
        count={t('ai.translation.entryCountSuffix', { count: total })}
        icon={<BookOpenText aria-hidden="true" className="size-4" />}
        title={t('routes.aiTranslationEntries.title')}
      />

      <div className="flex h-10 shrink-0 items-center gap-1.5 border-b border-neutral-200 bg-white px-4 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex shrink-0 items-center gap-1.5">
          <SelectField
            aria-label={t('ai.filter.keyPathAria')}
            onValueChange={(value) => {
              setKeyPath(isKeyPath(value) ? value : '')
              setPage(1)
            }}
            options={keyPathOptions}
            triggerClassName="w-36 !h-7 !border-transparent !bg-transparent text-xs hover:!bg-neutral-100 dark:hover:!bg-neutral-900"
            value={keyPath}
          />
          <TextInput
            controlClassName="h-7 w-24 !border-transparent !bg-transparent text-xs hover:!bg-neutral-100 dark:hover:!bg-neutral-900"
            onChange={(value) => {
              setLang(value)
              setPage(1)
            }}
            placeholder={t('ai.filter.langPlaceholder')}
            value={lang}
          />
        </div>
        <span className="ml-auto h-3.5 w-px shrink-0 bg-neutral-200 dark:bg-neutral-800" />
        <button
          aria-label={t('common.refresh')}
          className="outline-hidden inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:ring-2 focus-visible:ring-[var(--color-primary-shallow)] disabled:pointer-events-none disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
          type="button"
        >
          <RefreshCw
            aria-hidden="true"
            className={cn('size-3.5', query.isFetching && 'animate-spin')}
          />
        </button>
      </div>

      <Scroll className="min-h-0 flex-1" orientation="horizontal">
        {query.isLoading && entries.length === 0 ? (
          <GroupedResourceSkeleton />
        ) : query.isError ? (
          <ResourceError onRetry={() => void query.refetch()} />
        ) : entries.length === 0 ? (
          <ResourceEmpty label={t('ai.tab.entries')} />
        ) : (
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-b border-neutral-200 text-left text-xs uppercase text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
              <tr>
                <th className="px-4 py-3 font-medium">
                  {t('ai.translation.column.path')}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t('ai.translation.column.lang')}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t('ai.translation.column.source')}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t('ai.translation.column.translated')}
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  {t('ai.translation.column.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-900">
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-4 py-3 align-top">
                    <Code>{entry.keyPath}</Code>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <SmallBadge tone="info">{entry.lang}</SmallBadge>
                  </td>
                  <td className="max-w-xs px-4 py-3 align-top text-neutral-700 dark:text-neutral-300">
                    {entry.sourceText}
                  </td>
                  <td className="max-w-md px-4 py-3 align-top text-neutral-700 dark:text-neutral-300">
                    {entry.translatedText || '-'}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex justify-end gap-2">
                      <Button
                        disabled={updateMutation.isPending}
                        onClick={() => updateMutation.mutate(entry)}
                        type="button"
                        variant="subtle"
                      >
                        {t('ai.action.edit')}
                      </Button>
                      <Button
                        className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-950 dark:text-red-400 dark:hover:bg-red-950/30"
                        disabled={deleteMutation.isPending}
                        onClick={() => void confirmAndDelete(entry)}
                        type="button"
                        variant="subtle"
                      >
                        {t('ai.action.delete')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Scroll>

      {pageCount > 1 ? (
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <span className="text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
            {t('ai.page.pageIndex', { page })}
          </span>
          <CompactPagination
            onPageChange={setPage}
            onPageSizeChange={() => undefined}
            page={page}
            pageCount={pageCount}
            pageSize={PAGE_SIZE}
            pageSizes={[PAGE_SIZE]}
          />
        </div>
      ) : null}
    </FocusScope>
  )
}
