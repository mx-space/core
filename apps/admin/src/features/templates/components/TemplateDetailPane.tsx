import { Loader2, MailCheck, RefreshCw, RotateCcw, Save } from 'lucide-react'
import { useMemo } from 'react'
import type { TemplateType, TemplateViewMode } from '../types/templates'

import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { DESKTOP_MEDIA_QUERY, useMediaQuery } from '~/hooks/use-media-query'
import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { cn } from '~/utils/cn'

import { templateDescriptors } from '../constants'
import { TemplateCodeEditor } from './TemplateCodeEditor'
import { TemplatePreview } from './TemplatePreview'
import { TemplatePropsPopover } from './TemplatePropsPopover'
import { TemplateSkeleton } from './TemplateSkeleton'
import { TemplateViewToggle } from './TemplateViewToggle'

interface TemplateDetailPaneProps {
  defaultProps: unknown
  dirty: boolean
  loading: boolean
  onChangeSource: (value: string) => void
  onChangeProps: (next: unknown) => void
  onChangeView: (next: TemplateViewMode) => void
  onRefresh: () => void
  onReset: () => void
  onSave: () => void
  onTestSmtp: () => void
  previewError: string
  previewHtml: string
  propsKeys: string[]
  propsValue: unknown
  refreshing: boolean
  resetting: boolean
  saving: boolean
  source: string
  testing: boolean
  type: TemplateType
  viewMode: TemplateViewMode
}

export function TemplateDetailPane(props: TemplateDetailPaneProps) {
  const { t } = useI18n()
  const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY)
  const descriptor = useMemo(
    () =>
      templateDescriptors.find((entry) => entry.value === props.type) ??
      templateDescriptors[0],
    [props.type],
  )
  const Icon = descriptor.icon

  const effectiveViewMode: TemplateViewMode = isDesktop
    ? props.viewMode
    : props.viewMode === 'split'
      ? 'code'
      : props.viewMode

  return (
    <section className="flex h-full min-h-0 flex-col bg-white dark:bg-neutral-950">
      <header
        className={cn(
          'flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-4 dark:border-neutral-800',
          APP_SHELL_HEADER_HEIGHT_CLASS,
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <h2 className="inline-flex min-w-0 items-center gap-2 text-lg font-semibold">
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            <span className="truncate">{t(descriptor.labelKey)}</span>
          </h2>
          <TemplateViewToggle
            hideSplit={!isDesktop}
            onChange={props.onChangeView}
            value={effectiveViewMode}
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <TemplatePropsPopover
            defaultProps={props.defaultProps}
            onChange={props.onChangeProps}
            value={props.propsValue}
          />
          <Button
            disabled={props.testing}
            onClick={props.onTestSmtp}
            type="button"
            variant="subtle"
          >
            {props.testing ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <MailCheck aria-hidden="true" className="size-4" />
            )}
            <span className="hidden lg:inline">
              {t('templates.action.testSmtp')}
            </span>
          </Button>
          <Button
            disabled={props.refreshing}
            onClick={props.onRefresh}
            type="button"
            variant="subtle"
          >
            <RefreshCw
              aria-hidden="true"
              className={cn('size-4', props.refreshing && 'animate-spin')}
            />
            <span className="hidden lg:inline">{t('common.refresh')}</span>
          </Button>
          <Button
            disabled={props.resetting}
            onClick={props.onReset}
            type="button"
            variant="subtle"
          >
            {props.resetting ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <RotateCcw aria-hidden="true" className="size-4" />
            )}
            <span className="hidden lg:inline">{t('templates.reset')}</span>
          </Button>
          <Button
            disabled={props.saving || props.loading || !props.dirty}
            onClick={props.onSave}
            type="button"
          >
            {props.saving ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Save aria-hidden="true" className="size-4" />
            )}
            <span className="hidden lg:inline">
              {props.dirty ? t('common.save') : t('templates.saved')}
            </span>
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {props.loading ? (
          <div className="min-h-0 flex-1">
            <TemplateSkeleton />
          </div>
        ) : (
          <TemplateBody
            error={props.previewError}
            html={props.previewHtml}
            onChangeSource={props.onChangeSource}
            onSave={props.onSave}
            propsKeys={props.propsKeys}
            saving={props.saving}
            source={props.source}
            sourceDirty={props.dirty}
            viewMode={effectiveViewMode}
          />
        )}
      </div>
    </section>
  )
}

interface TemplateBodyProps {
  error: string
  html: string
  onChangeSource: (value: string) => void
  onSave: () => void
  propsKeys: string[]
  saving: boolean
  source: string
  sourceDirty: boolean
  viewMode: TemplateViewMode
}

function TemplateBody(props: TemplateBodyProps) {
  if (props.viewMode === 'code') {
    return (
      <div className="min-h-0 flex-1">
        <TemplateCodeEditor
          dirty={props.sourceDirty}
          onChange={props.onChangeSource}
          onSave={props.onSave}
          propsKeys={props.propsKeys}
          saving={props.saving}
          value={props.source}
        />
      </div>
    )
  }

  if (props.viewMode === 'preview') {
    return (
      <div className="min-h-0 flex-1">
        <TemplatePreview error={props.error} html={props.html} />
      </div>
    )
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-2 overflow-hidden">
      <div className="min-h-0 border-r border-neutral-200 dark:border-neutral-800">
        <TemplateCodeEditor
          dirty={props.sourceDirty}
          onChange={props.onChangeSource}
          onSave={props.onSave}
          propsKeys={props.propsKeys}
          saving={props.saving}
          value={props.source}
        />
      </div>
      <div className="min-h-0">
        <TemplatePreview error={props.error} html={props.html} />
      </div>
    </div>
  )
}
