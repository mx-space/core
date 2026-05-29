import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, RefreshCw, Upload } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import type { FileItem, FileType } from '~/api/files'
import type { TranslationKey, TranslationValues } from '~/i18n/types'
import type { ListAction } from '~/ui/list-actions'
import type { ChangeEvent } from 'react'
import type { FileRowItem } from '../utils/adapters'

import { deleteFileByTypeAndName, getFilesByType } from '~/api/files'
import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { DESKTOP_MEDIA_QUERY, useMediaQuery } from '~/hooks/use-media-query'
import { useI18n } from '~/i18n'
import { confirmDialog } from '~/ui/feedback/confirm'
import { FocusScope } from '~/ui/focus-scope'
import { MasterDetailLayout } from '~/ui/layout/page-layout'
import { useListKeyboard } from '~/ui/list-actions'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'
import { relativeTimeFromNow } from '~/utils/time'

import { filesQueryKey, fileTypeOptions } from '../constants'
import { useFileSearch } from '../hooks/useFileSearch'
import { useFileUploader } from '../hooks/useFileUploader'
import { adaptFileItem } from '../utils/adapters'
import { formatBytes, getErrorMessage } from '../utils/format'
import { mimeFromName } from '../utils/isImageMime'
import { ChipStrip } from './ChipStrip'
import { FileDetailEmpty } from './FileDetailEmpty'
import { FileDetailPane } from './FileDetailPane'
import { FileListEmpty } from './FileListEmpty'
import { FileListRow } from './FileListRow'
import { FileListSkeleton } from './FileListSkeleton'
import { FilePreviewLightbox } from './FilePreviewLightbox'
import { SearchRow } from './SearchRow'
import { MetadataGrid } from './sections/MetadataGrid'
import { PaletteSwatches } from './sections/PaletteSwatches'
import { UploadDropZoneShell } from './UploadDropOverlay'
import { UploadProgressDock } from './UploadProgressDock'

const FOCUS_SCOPE_ID = 'files-list'

function isFileType(value: string | null): value is FileType {
  return (
    value === 'avatar' ||
    value === 'file' ||
    value === 'icon' ||
    value === 'image'
  )
}

export function FilesByTypePage() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const searchParamsKey = searchParams.toString()

  const initialType = searchParams.get('type')
  const [fileType, setFileType] = useState<FileType>(
    isFileType(initialType) ? initialType : 'icon',
  )
  const [selectedName, setSelectedName] = useState<null | string>(
    searchParams.get('id'),
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [showDetailOnMobile, setShowDetailOnMobile] = useState(false)
  const [preview, setPreview] = useState<null | { name: string; url: string }>(
    null,
  )
  const [naturalSize, setNaturalSize] = useState<null | {
    width: number
    height: number
  }>(null)

  const uploadInputRef = useRef<HTMLInputElement>(null)
  const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY)

  const currentTypeOption = fileTypeOptions.find(
    (option) => option.value === fileType,
  )!

  const filesQuery = useQuery({
    queryFn: () => getFilesByType(fileType),
    queryKey: [...filesQueryKey, 'by-type', fileType],
  })

  const allFiles = filesQuery.data ?? []
  const adapted = useMemo(
    () => allFiles.map((item) => adaptFileItem(item)),
    [allFiles],
  )
  const fileSearch = useFileSearch(adapted)
  const filtered = fileSearch.items

  useEffect(() => {
    if (fileSearch.query !== searchQuery) fileSearch.setQuery(searchQuery)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery])

  const selectedItem = useMemo(() => {
    if (!selectedName) return null
    return adapted.find((item) => item.id === selectedName) ?? null
  }, [adapted, selectedName])

  useLayoutEffect(() => {
    const nextType = searchParams.get('type')
    const nextId = searchParams.get('id')
    if (isFileType(nextType) && nextType !== fileType) {
      setFileType(nextType)
    }
    if (nextId !== selectedName) {
      setSelectedName(nextId)
      setShowDetailOnMobile(Boolean(nextId))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParamsKey])

  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    next.set('type', fileType)
    if (selectedName) next.set('id', selectedName)
    else next.delete('id')
    if (next.toString() !== searchParamsKey) {
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileType, selectedName])

  useEffect(() => {
    setNaturalSize(null)
  }, [selectedItem?.url])

  const deleteMutation = useMutation({
    mutationFn: (item: FileItem) =>
      deleteFileByTypeAndName(fileType, item.name),
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, t('files.toast.deleteFailed'))),
    onSuccess: async () => {
      toast.success(t('files.toast.fileDeleted'))
      setSelectedName(null)
      setShowDetailOnMobile(false)
      await queryClient.invalidateQueries({ queryKey: filesQueryKey })
    },
  })

  const uploader = useFileUploader({
    acceptImage: currentTypeOption.acceptImage,
    notImageMessage: (name) => t('files.toast.notImageFile', { name }),
    onSettled: async ({ successCount }) => {
      if (successCount > 0) {
        toast.success(t('files.toast.uploaded', { count: successCount }))
        await queryClient.invalidateQueries({ queryKey: filesQueryKey })
      }
    },
    onValidationError: (message) => toast.error(message),
    type: fileType,
    uploadFailedMessage: t('files.toast.uploadFailed'),
  })

  const confirmAndDelete = async (item: FileRowItem<FileItem>) => {
    const ok = await confirmDialog({
      destructive: true,
      title: t('files.confirmDeleteNamed', { name: item.name }),
    })
    if (!ok) return
    deleteMutation.mutate(item.raw)
  }

  const openItem = (item: FileRowItem<FileItem>) => {
    setSelectedName(item.id)
    setShowDetailOnMobile(true)
  }

  const actions = useMemo<ListAction<FileRowItem<FileItem>>[]>(
    () => [
      {
        key: 'open',
        label: t('files.action.previewImage'),
        run: (targets) => openItem(targets[0]),
        shortcut: 'Enter',
        shortcutLabel: '↵',
      },
      {
        danger: true,
        key: 'delete',
        label: t('common.delete'),
        multi: false,
        run: (targets) => confirmAndDelete(targets[0]),
        shortcut: 'Backspace',
        shortcutLabel: '⌫',
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, fileType],
  )

  const { selection } = useListKeyboard<FileRowItem<FileItem>>({
    actions,
    getId: (item) => item.id,
    items: filtered,
    resetOn: [fileType, searchQuery],
    scopeId: FOCUS_SCOPE_ID,
  })

  const onUploadChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    void uploader.upload(files)
  }

  const fileChipOptions = fileTypeOptions.map((option) => ({
    icon: option.icon,
    label: t(option.labelKey),
    value: option.value,
  }))

  const refreshing = filesQuery.isFetching

  return (
    <>
      <MasterDetailLayout
        list={
          <UploadDropZoneShell
            enabled={isDesktop}
            hint={
              currentTypeOption.acceptImage
                ? t('files.upload.overlay.hint.image')
                : t('files.upload.overlay.hint.any')
            }
            label={t('files.upload.overlay.label')}
            onFiles={(files) => void uploader.upload(files)}
          >
            <FocusScope
              className="outline-hidden flex h-full min-h-0 flex-col"
              id={FOCUS_SCOPE_ID}
            >
              <header
                className={cn(
                  'flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-4 dark:border-neutral-800',
                  APP_SHELL_HEADER_HEIGHT_CLASS,
                )}
              >
                <h2 className="flex min-w-0 items-baseline gap-2 text-lg font-semibold">
                  <span className="truncate">{t('files.source.files')}</span>
                  <span className="text-xs font-normal tabular-nums text-neutral-400 dark:text-neutral-500">
                    {filtered.length}
                  </span>
                </h2>
                <div className="flex shrink-0 items-center gap-1">
                  <input
                    accept={
                      currentTypeOption.acceptImage ? 'image/*' : undefined
                    }
                    className="hidden"
                    multiple
                    onChange={onUploadChange}
                    ref={uploadInputRef}
                    type="file"
                  />
                  <Button
                    aria-label={t('files.action.upload')}
                    disabled={uploader.busy}
                    onClick={() => uploadInputRef.current?.click()}
                    type="button"
                    variant="subtle"
                  >
                    {uploader.busy ? (
                      <Loader2
                        aria-hidden="true"
                        className="size-4 animate-spin"
                      />
                    ) : (
                      <Upload aria-hidden="true" className="size-4" />
                    )}
                    <span>{t('files.action.upload')}</span>
                  </Button>
                  <Button
                    aria-label={t('files.action.refresh')}
                    disabled={refreshing}
                    iconOnly
                    onClick={() => void filesQuery.refetch()}
                    type="button"
                    variant="subtle"
                  >
                    <RefreshCw
                      aria-hidden="true"
                      className={cn('size-4', refreshing && 'animate-spin')}
                    />
                  </Button>
                </div>
              </header>

              <ChipStrip
                ariaLabel={t('files.source.files')}
                onChange={(next) => {
                  setFileType(next)
                  setSelectedName(null)
                  setShowDetailOnMobile(false)
                }}
                options={fileChipOptions}
                value={fileType}
              />

              <SearchRow
                onChange={setSearchQuery}
                placeholder={t('files.search.placeholder')}
                value={searchQuery}
              />

              <Scroll className="flex-1">
                {filesQuery.isLoading && adapted.length === 0 ? (
                  <FileListSkeleton />
                ) : filtered.length === 0 ? (
                  <FileListEmpty
                    label={
                      searchQuery
                        ? t('files.search.noMatches')
                        : t('files.empty.files')
                    }
                  />
                ) : (
                  filtered.map((item) => (
                    <FileListRow<FileItem>
                      actions={actions}
                      isDetailTarget={selectedName === item.id}
                      item={item}
                      key={item.id}
                      onSelect={(mode) => {
                        if (mode === 'range') selection.selectRange(item.id)
                        else if (mode === 'toggle')
                          selection.toggleWithAnchor(item.id)
                        else {
                          selection.selectOne(item.id)
                          openItem(item)
                        }
                      }}
                      selected={selection.isSelected(item.id)}
                    />
                  ))
                )}
              </Scroll>

              <UploadProgressDock items={uploader.items} />
            </FocusScope>
          </UploadDropZoneShell>
        }
        showDetailOnMobile={showDetailOnMobile}
        detail={
          <section className="h-full min-h-0">
            {selectedItem ? (
              <FileDetailPane
                thumbhash={selectedItem.thumbhash}
                deleteDisabled={deleteMutation.isPending}
                dominantColor={selectedItem.palette?.dominant}
                isMobile={!isDesktop}
                name={selectedItem.name}
                onBack={() => setShowDetailOnMobile(false)}
                onDelete={() => void confirmAndDelete(selectedItem)}
                onDimensions={setNaturalSize}
                onOpenPreview={() =>
                  setPreview({ name: selectedItem.name, url: selectedItem.url })
                }
                sections={buildSections({
                  item: selectedItem,
                  naturalSize,
                  t,
                  typeLabel: t(currentTypeOption.labelKey),
                })}
                url={selectedItem.url}
              />
            ) : (
              <FileDetailEmpty />
            )}
          </section>
        }
      />
      <FilePreviewLightbox image={preview} onClose={() => setPreview(null)} />
    </>
  )
}

type Translator = (key: TranslationKey, values?: TranslationValues) => string

function buildSections(args: {
  item: FileRowItem<FileItem>
  naturalSize: null | { width: number; height: number }
  t: Translator
  typeLabel: string
}) {
  const { item, naturalSize, t, typeLabel } = args
  const created = item.raw.created ? new Date(item.raw.created) : null
  const mime = mimeFromName(item.name)
  const unknown = t('files.detail.value.unknown')

  return [
    {
      key: 'basics',
      title: t('files.detail.section.basics'),
      body: (
        <MetadataGrid
          entries={[
            {
              key: 'url',
              label: t('files.detail.field.url'),
              mono: true,
              value: item.url,
            },
            {
              key: 'type',
              label: t('files.detail.field.type'),
              value: typeLabel,
            },
            {
              key: 'created',
              label: t('files.detail.field.created'),
              value: created
                ? `${relativeTimeFromNow(created)} (${created.toLocaleString()})`
                : unknown,
            },
          ]}
        />
      ),
    },
    {
      key: 'image',
      title: t('files.detail.section.image'),
      body: (
        <MetadataGrid
          entries={[
            {
              key: 'mime',
              label: t('files.detail.field.mime'),
              value: mime ?? unknown,
            },
            {
              key: 'size',
              label: t('files.detail.field.size'),
              value: formatBytes(undefined),
            },
            {
              key: 'dimensions',
              label: t('files.detail.field.dimensions'),
              value: naturalSize
                ? `${naturalSize.width} × ${naturalSize.height}`
                : unknown,
            },
          ]}
        />
      ),
    },
    {
      key: 'appearance',
      title: t('files.detail.section.appearance'),
      body: (
        <MetadataGrid
          entries={[
            {
              key: 'palette',
              label: t('files.detail.field.palette'),
              value: <PaletteSwatches palette={item.palette} />,
            },
            {
              key: 'thumbhash',
              label: t('files.detail.field.thumbhash'),
              mono: true,
              value: item.thumbhash ?? unknown,
            },
          ]}
        />
      ),
    },
  ]
}
