import { FileDown } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { importMarkdown } from '~/api/markdown'
import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import { MobileHeaderAffordance } from '~/ui/layout/mobile-header-affordance'
import { cn } from '~/utils/cn'
import { ParseMarkdownYAML } from '~/utils/markdown-parser'

import type { ParsedItem } from '../types/markdown'
import { ImportType } from '../types/markdown'
import { readMarkdownFile } from '../utils/files'
import { getErrorMessage } from '../utils/format'
import { ExportPanel } from './export/ExportPanel'
import { ImportSection } from './import/ImportSection'
import { presentImportConfirm } from './ImportConfirmModal'
import type { MarkdownView } from './MarkdownViewTabs'
import { MarkdownViewTabs } from './MarkdownViewTabs'

type MetaEdits = Partial<NonNullable<ParsedItem['meta']>>

interface ParseOutcome {
  failureReason?: string
  item: ParsedItem
}

async function parseOneFile(file: File): Promise<ParseOutcome> {
  const baseTitle = file.name.replace(/\.md(?:own)?$/i, '')
  const fallback: ParsedItem = {
    filename: file.name,
    meta: {
      date: new Date().toISOString(),
      slug: baseTitle,
      title: baseTitle,
    },
    text: '',
  }

  try {
    const content = await readMarkdownFile(file)
    const parser = new ParseMarkdownYAML([content])
    const [parsed] = parser.start()
    const meta: Partial<NonNullable<ParsedItem['meta']>> = parsed.meta ?? {}
    return {
      item: {
        filename: file.name,
        meta: {
          ...meta,
          date: meta.date ?? new Date().toISOString(),
          slug: meta.slug ?? baseTitle,
          title: meta.title ?? baseTitle,
        },
        text: parsed.text,
      },
    }
  } catch (error) {
    const raw =
      error instanceof Error ? error.message : String(error ?? 'parse error')
    return {
      failureReason: raw,
      item: fallback,
    }
  }
}

export function MarkdownRouteViewContent() {
  const { t } = useI18n()
  const [importType, setImportType] = useState<ImportType>(ImportType.Post)
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([])
  const [editedMetaByFilename, setEditedMetaByFilename] = useState<
    Record<string, MetaEdits>
  >({})
  const [failureReasons, setFailureReasons] = useState<Record<string, string>>(
    {},
  )
  const [selectedFilename, setSelectedFilename] = useState<null | string>(null)
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [invalidSet, setInvalidSet] = useState<Set<string>>(new Set())
  const [view, setView] = useState<MarkdownView>('import')

  const failedSet = useMemo(
    () => new Set(Object.keys(failureReasons)),
    [failureReasons],
  )

  const totalChars = useMemo(
    () => parsedItems.reduce((acc, it) => acc + it.text.length, 0),
    [parsedItems],
  )

  const handleAppend = useCallback(
    async (incoming: File[]) => {
      if (incoming.length === 0) return

      const accepted: File[] = []
      const rejected: File[] = []
      for (const file of incoming) {
        const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
        if (ext === 'md' || ext === 'markdown') accepted.push(file)
        else rejected.push(file)
      }
      if (rejected.length > 0) {
        toast.warning(
          t('markdown.import.fileTypeReject', { count: rejected.length }),
        )
      }
      if (accepted.length === 0) return

      const existing = new Set(parsedItems.map((it) => it.filename))
      const seen = new Set<string>()
      const dedupedFiles: File[] = []
      const skipped: string[] = []
      for (const file of accepted) {
        if (existing.has(file.name) || seen.has(file.name)) {
          skipped.push(file.name)
        } else {
          seen.add(file.name)
          dedupedFiles.push(file)
        }
      }
      if (skipped.length > 0) {
        toast.info(t('markdown.import.skipDup', { names: skipped.join(', ') }))
      }
      if (dedupedFiles.length === 0) return

      setParsing(true)
      try {
        const results = await Promise.all(dedupedFiles.map(parseOneFile))
        const nextFailures: Record<string, string> = { ...failureReasons }
        const newItems: ParsedItem[] = []
        for (const result of results) {
          newItems.push(result.item)
          if (result.failureReason) {
            nextFailures[result.item.filename] = result.failureReason
          }
        }
        setParsedItems((prev) => [...prev, ...newItems])
        setFailureReasons(nextFailures)
        const successCount = results.filter((r) => !r.failureReason).length
        if (successCount > 0) {
          toast.success(
            t('markdown.import.parseSuccess', { count: successCount }),
          )
        }
        setSelectedFilename((current) => {
          if (current) return current
          const firstSucceeded = results.find((r) => !r.failureReason)
          return firstSucceeded?.item.filename ?? newItems[0]?.filename ?? null
        })
      } catch (error) {
        toast.error(getErrorMessage(error, t('markdown.import.parseFailed')))
      } finally {
        setParsing(false)
      }
    },
    [failureReasons, parsedItems, t],
  )

  const handleEdit = useCallback((filename: string, partial: MetaEdits) => {
    setEditedMetaByFilename((prev) => ({
      ...prev,
      [filename]: { ...prev[filename], ...partial },
    }))
    setInvalidSet((prev) => {
      if (!prev.has(filename)) return prev
      const next = new Set(prev)
      next.delete(filename)
      return next
    })
  }, [])

  const handleResetEdits = useCallback((filename: string) => {
    setEditedMetaByFilename((prev) => {
      if (!(filename in prev)) return prev
      const next = { ...prev }
      delete next[filename]
      return next
    })
  }, [])

  const handleRemove = useCallback(
    (filename: string) => {
      setParsedItems((prev) => prev.filter((it) => it.filename !== filename))
      setEditedMetaByFilename((prev) => {
        if (!(filename in prev)) return prev
        const next = { ...prev }
        delete next[filename]
        return next
      })
      setFailureReasons((prev) => {
        if (!(filename in prev)) return prev
        const next = { ...prev }
        delete next[filename]
        return next
      })
      setInvalidSet((prev) => {
        if (!prev.has(filename)) return prev
        const next = new Set(prev)
        next.delete(filename)
        return next
      })
      setSelectedFilename((current) => {
        if (current !== filename) return current
        const remaining = parsedItems.find((it) => it.filename !== filename)
        return remaining?.filename ?? null
      })
    },
    [parsedItems],
  )

  const handleClear = useCallback(() => {
    setParsedItems([])
    setEditedMetaByFilename({})
    setFailureReasons({})
    setInvalidSet(new Set())
    setSelectedFilename(null)
  }, [])

  const handleSelect = useCallback((filename: string) => {
    setSelectedFilename(filename === '' ? null : filename)
  }, [])

  const handleSubmit = useCallback(async () => {
    const eligibleItems = parsedItems.filter(
      (it) => !failedSet.has(it.filename),
    )

    const invalid = new Set<string>()
    for (const item of eligibleItems) {
      const edits = editedMetaByFilename[item.filename] ?? {}
      const meta = item.meta ?? {}
      const title = (edits.title ?? meta.title ?? '').trim()
      const slug = (edits.slug ?? meta.slug ?? '').trim()
      if (!title || !slug) invalid.add(item.filename)
    }
    setInvalidSet(invalid)

    if (invalid.size > 0) {
      toast.error(t('markdown.import.missingFields', { count: invalid.size }))
      const first = invalid.values().next().value
      if (first) setSelectedFilename(first)
      return
    }

    if (eligibleItems.length === 0) {
      toast.warning(t('markdown.import.parseFirst'))
      return
    }

    const ok = await presentImportConfirm({
      importType,
      itemCount: eligibleItems.length,
    })
    if (!ok) return

    setImporting(true)
    try {
      const payload = eligibleItems.map((it) => {
        const edits = editedMetaByFilename[it.filename] ?? {}
        return {
          ...it,
          meta: { ...it.meta, ...edits },
        }
      })
      await importMarkdown({
        data: payload,
        type: importType,
      })
      toast.success(
        t('markdown.import.importSuccess', { count: payload.length }),
      )
      handleClear()
    } catch (error) {
      toast.error(getErrorMessage(error, t('markdown.import.importFailed')))
    } finally {
      setImporting(false)
    }
  }, [editedMetaByFilename, failedSet, handleClear, importType, parsedItems, t])

  return (
    <section className="flex h-full min-h-0 flex-col bg-background">
      <header
        className={cn(
          'flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-4 dark:border-neutral-800',
          APP_SHELL_HEADER_HEIGHT_CLASS,
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <MobileHeaderAffordance />
          <div className="min-w-0">
            <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-neutral-950 dark:text-neutral-50">
              <FileDown aria-hidden="true" className="size-4" />
              Markdown
            </h2>
            <span className="ml-3 text-xs text-neutral-500 dark:text-neutral-400">
              {t('markdown.subtitle')}
            </span>
          </div>
        </div>
      </header>

      <MarkdownViewTabs onChange={setView} value={view} />

      {view === 'import' ? (
        <ImportSection
          editedMetaByFilename={editedMetaByFilename}
          failedSet={failedSet}
          failureReasons={failureReasons}
          importType={importType}
          importing={importing}
          invalidSet={invalidSet}
          onAppend={(files) => void handleAppend(files)}
          onClear={handleClear}
          onEdit={handleEdit}
          onImportTypeChange={setImportType}
          onRemove={handleRemove}
          onResetEdits={handleResetEdits}
          onSelect={handleSelect}
          onSubmit={() => void handleSubmit()}
          parsedItems={parsedItems}
          parsing={parsing}
          selectedFilename={selectedFilename}
          totalChars={totalChars}
        />
      ) : (
        <ExportPanel />
      )}
    </section>
  )
}
