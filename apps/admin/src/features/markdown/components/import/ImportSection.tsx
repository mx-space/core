import type { ParsedItem } from '../../types/markdown'

import { DESKTOP_MEDIA_QUERY, useMediaQuery } from '~/hooks/use-media-query'
import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { cn } from '~/utils/cn'

import { ImportType } from '../../types/markdown'
import { DropZone } from './DropZone'
import { FileQueueList } from './FileQueueList'
import { ImportTopBar } from './ImportTopBar'
import { ParsedPreviewPane } from './ParsedPreviewPane'

type MetaEdits = Partial<NonNullable<ParsedItem['meta']>>

interface ImportSectionProps {
  editedMetaByFilename: Record<string, MetaEdits>
  failedSet: Set<string>
  failureReasons: Record<string, string>
  importType: ImportType
  importing: boolean
  invalidSet: Set<string>
  onAppend: (files: File[]) => void
  onClear: () => void
  onEdit: (filename: string, partial: MetaEdits) => void
  onImportTypeChange: (next: ImportType) => void
  onRemove: (filename: string) => void
  onResetEdits: (filename: string) => void
  onSelect: (filename: string) => void
  onSubmit: () => void
  parsedItems: ParsedItem[]
  parsing: boolean
  selectedFilename: null | string
  totalChars: number
}

export function ImportSection(props: ImportSectionProps) {
  const { t } = useI18n()
  const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY)
  const hasData = props.parsedItems.length > 0
  const editedSet = new Set(Object.keys(props.editedMetaByFilename))

  const selectedItem = props.selectedFilename
    ? (props.parsedItems.find((it) => it.filename === props.selectedFilename) ??
      null)
    : null

  const previewPane = selectedItem ? (
    <ParsedPreviewPane
      edits={props.editedMetaByFilename[selectedItem.filename]}
      failed={props.failedSet.has(selectedItem.filename)}
      failureReason={props.failureReasons[selectedItem.filename]}
      invalid={props.invalidSet.has(selectedItem.filename)}
      item={selectedItem}
      onEdit={props.onEdit}
      onRemove={props.onRemove}
      onResetEdits={props.onResetEdits}
    />
  ) : (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
      {t('markdown.import.selectFileHint')}
    </div>
  )

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <ImportTopBar
        hasData={hasData}
        importType={props.importType}
        importing={props.importing}
        onClear={props.onClear}
        onImportTypeChange={props.onImportTypeChange}
        onSubmit={props.onSubmit}
        parsedCount={props.parsedItems.length}
        totalChars={props.totalChars}
      />

      {!hasData ? (
        <div className="flex min-h-0 flex-1 p-4">
          <DropZone
            mode="large"
            onFiles={props.onAppend}
            parsing={props.parsing}
          />
        </div>
      ) : isDesktop ? (
        <div
          className={cn(
            'grid min-h-0 flex-1 grid-cols-[minmax(0,38%)_minmax(0,62%)]',
          )}
        >
          <div className="min-h-0 border-r border-neutral-200 dark:border-neutral-800">
            <FileQueueList
              editedSet={editedSet}
              failedSet={props.failedSet}
              items={props.parsedItems}
              onAppend={props.onAppend}
              onClear={props.onClear}
              onRemove={props.onRemove}
              onSelect={props.onSelect}
              parsing={props.parsing}
              selectedFilename={props.selectedFilename}
            />
          </div>
          <div className="min-h-0 bg-neutral-50/40 dark:bg-neutral-950">
            {previewPane}
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {props.selectedFilename ? (
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex h-10 shrink-0 items-center gap-2 border-b border-neutral-200 px-3 dark:border-neutral-800">
                <Button
                  className="h-8 px-2 text-xs"
                  onClick={() => props.onSelect('')}
                  type="button"
                  variant="subtle"
                >
                  ←{' '}
                  {t('markdown.import.filesCount', {
                    count: props.parsedItems.length,
                  })}
                </Button>
              </div>
              <div className="min-h-0 flex-1">{previewPane}</div>
            </div>
          ) : (
            <FileQueueList
              editedSet={editedSet}
              failedSet={props.failedSet}
              items={props.parsedItems}
              onAppend={props.onAppend}
              onClear={props.onClear}
              onRemove={props.onRemove}
              onSelect={props.onSelect}
              parsing={props.parsing}
              selectedFilename={props.selectedFilename}
            />
          )}
        </div>
      )}
    </section>
  )
}
