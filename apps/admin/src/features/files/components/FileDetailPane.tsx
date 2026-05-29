import { Copy, ExternalLink, FileIcon, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { ReactNode } from 'react'

import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import { HeaderBackButton } from '~/ui/layout/header-back-button'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'

import { isImageByName } from '../utils/isImageMime'
import { FileThumbnail } from './FileThumbnail'

export interface DetailSection {
  key: string
  title: string
  body: ReactNode
}

interface FileDetailPaneProps {
  name: string
  url: string
  thumbhash?: null | string
  dominantColor?: string
  sections: DetailSection[]
  isMobile?: boolean
  onBack?: () => void
  onOpenPreview?: () => void
  onDelete?: () => void
  deleteDisabled?: boolean
  extraHeaderActions?: ReactNode
  onDimensions?: (dim: { width: number; height: number }) => void
}

export function FileDetailPane(props: FileDetailPaneProps) {
  const { t } = useI18n()
  const showImage = isImageByName(props.name)

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(props.url)
      toast.success(t('files.toast.copied'))
    } catch {
      toast.error(t('files.toast.copyFailed'))
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white dark:bg-neutral-950">
      <header
        className={cn(
          'flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-4 dark:border-neutral-800',
          APP_SHELL_HEADER_HEIGHT_CLASS,
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          {props.isMobile && props.onBack ? (
            <HeaderBackButton onClick={props.onBack} />
          ) : null}
          <h2 className="truncate text-lg font-semibold text-neutral-950 dark:text-neutral-50">
            {props.name}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {props.extraHeaderActions}
          <IconActionButton
            label={t('files.action.copyLink')}
            onClick={copyLink}
          >
            <Copy aria-hidden="true" className="size-4" />
          </IconActionButton>
          <a
            aria-label={t('files.action.open')}
            className="inline-flex size-9 items-center justify-center rounded text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            href={props.url}
            rel="noreferrer"
            target="_blank"
            title={t('files.action.open')}
          >
            <ExternalLink aria-hidden="true" className="size-4" />
          </a>
          {props.onDelete ? (
            <IconActionButton
              danger
              disabled={props.deleteDisabled}
              label={t('files.action.delete')}
              onClick={props.onDelete}
            >
              <Trash2 aria-hidden="true" className="size-4" />
            </IconActionButton>
          ) : null}
        </div>
      </header>

      <Scroll className="min-h-0 flex-1">
        <div className="mx-auto max-w-3xl space-y-5 p-6">
          {showImage ? (
            <DetailHeroImage
              alt={props.name}
              thumbhash={props.thumbhash}
              dominantColor={props.dominantColor}
              onClick={props.onOpenPreview}
              onDimensions={props.onDimensions}
              src={props.url}
            />
          ) : (
            <DetailHeroFile name={props.name} />
          )}
          {props.sections.map((section) => (
            <DetailSectionBlock key={section.key} title={section.title}>
              {section.body}
            </DetailSectionBlock>
          ))}
        </div>
      </Scroll>
    </div>
  )
}

function DetailHeroImage(props: {
  alt: string
  thumbhash?: null | string
  dominantColor?: string
  onClick?: () => void
  onDimensions?: (dim: { width: number; height: number }) => void
  src: string
}) {
  const [naturalSize, setNaturalSize] = useState<null | {
    width: number
    height: number
  }>(null)

  useEffect(() => {
    setNaturalSize(null)
  }, [props.src])

  useEffect(() => {
    if (naturalSize) props.onDimensions?.(naturalSize)
  }, [naturalSize, props])

  return (
    <button
      className="block w-full overflow-hidden rounded border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900"
      onClick={props.onClick}
      type="button"
    >
      <span
        className="relative flex max-h-[50vh] w-full items-center justify-center"
        style={{ maxHeight: 'min(50vh, 480px)' }}
      >
        <FileThumbnail
          alt={props.alt}
          thumbhash={props.thumbhash}
          className="max-h-[50vh] w-full object-contain"
          dominantColor={props.dominantColor}
          src={props.src}
        />
        <img
          alt=""
          aria-hidden="true"
          className="hidden"
          onLoad={(event) => {
            const img = event.currentTarget
            setNaturalSize({
              width: img.naturalWidth,
              height: img.naturalHeight,
            })
          }}
          src={props.src}
        />
      </span>
    </button>
  )
}

function DetailHeroFile(props: { name: string }) {
  return (
    <div className="flex h-40 items-center justify-center rounded border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-col items-center gap-2 text-neutral-500 dark:text-neutral-400">
        <FileIcon aria-hidden="true" className="size-10 text-neutral-400" />
        <span className="text-sm">{props.name}</span>
      </div>
    </div>
  )
}

function DetailSectionBlock(props: { title: string; children: ReactNode }) {
  return (
    <section className="rounded border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <h3 className="border-b border-neutral-200 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
        {props.title}
      </h3>
      <div className="px-4 py-3 text-sm text-neutral-700 dark:text-neutral-300">
        {props.children}
      </div>
    </section>
  )
}

function IconActionButton(props: {
  children: ReactNode
  danger?: boolean
  disabled?: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      aria-label={props.label}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded text-neutral-500 transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        props.danger
          ? 'hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400'
          : 'hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100',
      )}
      disabled={props.disabled}
      onClick={props.onClick}
      title={props.label}
      type="button"
    >
      {props.children}
    </button>
  )
}
