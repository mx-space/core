import { Loader2, MailCheck, RefreshCw, RotateCcw, Save } from 'lucide-react'
import { useState } from 'react'

import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { DESKTOP_MEDIA_QUERY, useMediaQuery } from '~/hooks/use-media-query'
import { useI18n } from '~/i18n'
import { MobileHeaderAffordance } from '~/ui/layout/mobile-header-affordance'
import { Button } from '~/ui/primitives/button'
import { SegmentedControl } from '~/ui/primitives/segmented-control'
import { cn } from '~/utils/cn'

import type { TemplatePaneMode } from '../types/templates'
import { TemplateCodeEditor } from './TemplateCodeEditor'
import { TemplatePreview } from './TemplatePreview'
import { TemplatePropsPopover } from './TemplatePropsPopover'
import { useTemplatesRouteContext } from './templates-route-context'
import { TemplateSkeleton } from './TemplateSkeleton'
import { TemplateSplitView } from './TemplateSplitView'
import { TemplateSwitcher } from './TemplateSwitcher'

/**
 * Single pane: template switcher + actions in the header, editor | preview
 * below. The former master list column is gone — three fixed templates live in
 * the switcher menu instead. Desktop always splits; below `lg` one pane shows
 * at a time, chosen with a two-state control.
 */
export function TemplateDetailPane() {
  const ctx = useTemplatesRouteContext()
  const { t } = useI18n()
  const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY)
  const [compactMode, setCompactMode] = useState<TemplatePaneMode>('code')

  return (
    <section className="flex h-full min-h-0 flex-col bg-surface-card">
      <header
        className={cn(
          'flex shrink-0 items-center gap-3 border-b border-border px-4',
          APP_SHELL_HEADER_HEIGHT_CLASS,
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <MobileHeaderAffordance />
          <TemplateSwitcher
            dirty={ctx.dirty}
            onChange={ctx.onSelect}
            type={ctx.type}
          />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {isDesktop ? null : (
            <SegmentedControl<TemplatePaneMode>
              aria-label={t('templates.view.aria')}
              className="mr-1"
              onValueChange={setCompactMode}
              options={[
                { label: t('templates.view.code'), value: 'code' },
                { label: t('templates.view.preview'), value: 'preview' },
              ]}
              value={compactMode}
            />
          )}
          <TemplatePropsPopover
            defaultProps={ctx.defaultProps}
            onChange={ctx.onChangeProps}
            value={ctx.propsValue}
          />
          <Button
            disabled={ctx.testing}
            onClick={ctx.onTestSmtp}
            type="button"
            variant="subtle"
          >
            {ctx.testing ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <MailCheck aria-hidden="true" className="size-4" />
            )}
            <span className="hidden lg:inline">
              {t('templates.action.testSmtp')}
            </span>
          </Button>
          <Button
            disabled={ctx.refreshing}
            onClick={ctx.onRefresh}
            type="button"
            variant="subtle"
          >
            <RefreshCw
              aria-hidden="true"
              className={cn('size-4', ctx.refreshing && 'animate-spin')}
            />
            <span className="hidden lg:inline">{t('common.refresh')}</span>
          </Button>
          <Button
            disabled={ctx.resetting}
            onClick={ctx.onReset}
            type="button"
            variant="subtle"
          >
            {ctx.resetting ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <RotateCcw aria-hidden="true" className="size-4" />
            )}
            <span className="hidden lg:inline">{t('templates.reset')}</span>
          </Button>
          <Button
            disabled={ctx.saving || ctx.loading || !ctx.dirty}
            onClick={ctx.onSave}
            type="button"
          >
            {ctx.saving ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Save aria-hidden="true" className="size-4" />
            )}
            <span className="hidden lg:inline">
              {ctx.dirty ? t('common.save') : t('templates.saved')}
            </span>
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {ctx.loading ? (
          <div className="min-h-0 flex-1">
            <TemplateSkeleton />
          </div>
        ) : isDesktop ? (
          <TemplateSplitView
            dirty={ctx.dirty}
            error={ctx.previewError}
            html={ctx.previewHtml}
            onChangeSource={ctx.onChangeSource}
            onSave={ctx.onSave}
            propsKeys={ctx.propsKeys}
            saving={ctx.saving}
            source={ctx.source}
          />
        ) : (
          <div className="min-h-0 flex-1">
            {compactMode === 'code' ? (
              <TemplateCodeEditor
                dirty={ctx.dirty}
                onChange={ctx.onChangeSource}
                onSave={ctx.onSave}
                propsKeys={ctx.propsKeys}
                saving={ctx.saving}
                value={ctx.source}
              />
            ) : (
              <TemplatePreview
                error={ctx.previewError}
                html={ctx.previewHtml}
              />
            )}
          </div>
        )}
      </div>
    </section>
  )
}
