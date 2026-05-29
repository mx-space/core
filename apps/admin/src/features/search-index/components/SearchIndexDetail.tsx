import { ArrowLeft, ExternalLink, Loader2, RotateCcw } from 'lucide-react'
import { Link } from 'react-router'
import type { SearchDocumentAdminRow } from '~/api/search-index'

import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'

import {
  buildEditUrl,
  formatDateTime,
  formatRelativeDate,
} from '../utils/format'
import { Code } from './Code'
import { Field } from './Field'
import { RefTypeBadge } from './RefTypeBadge'
import { SmallBadge } from './SmallBadge'

export function SearchIndexDetail(props: {
  onBack: () => void
  onRebuild: () => void
  rebuilding: boolean
  row: SearchDocumentAdminRow
}) {
  const { t } = useI18n()
  const row = props.row
  const editUrl = buildEditUrl(row.refType, row.refId)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className={cn(
          'flex shrink-0 items-center gap-2 border-b border-neutral-200 px-4 dark:border-neutral-800',
          APP_SHELL_HEADER_HEIGHT_CLASS,
        )}
      >
        <button
          className="inline-flex size-8 items-center justify-center rounded text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-950 lg:hidden dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-50"
          onClick={props.onBack}
          type="button"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
        </button>
        <RefTypeBadge refType={row.refType} />
        <h2 className="min-w-0 flex-1 truncate text-lg font-semibold text-neutral-950 dark:text-neutral-50">
          {row.title || (
            <span className="text-neutral-400">
              {t('searchIndex.row.untitled')}
            </span>
          )}
        </h2>
        <div className="flex shrink-0 items-center gap-1">
          {editUrl ? (
            <Link
              aria-label={t('searchIndex.action.viewSource')}
              className="outline-hidden inline-flex size-9 items-center justify-center rounded text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-950 focus-visible:ring-2 focus-visible:ring-neutral-400 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-50"
              title={t('searchIndex.action.viewSource')}
              to={editUrl}
            >
              <ExternalLink aria-hidden="true" className="size-4" />
            </Link>
          ) : null}
          <Button
            disabled={props.rebuilding}
            onClick={props.onRebuild}
            type="button"
            variant="primary"
          >
            {props.rebuilding ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <RotateCcw aria-hidden="true" className="size-4" />
            )}
            {t('searchIndex.action.rebuild')}
          </Button>
        </div>
      </div>

      <Scroll className="flex-1" innerClassName="px-5 py-4">
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
          <Field label="refId">
            <Code>{row.refId}</Code>
          </Field>
          <Field label={t('searchIndex.detail.field.lang')}>
            {row.lang ? (
              <SmallBadge>{row.lang}</SmallBadge>
            ) : (
              t('searchIndex.detail.langDefault')
            )}
          </Field>
          <Field label={t('searchIndex.detail.field.sourceHash')}>
            <Code title={row.sourceHash}>{row.sourceHash || '-'}</Code>
          </Field>
          <Field label={t('searchIndex.detail.field.publishState')}>
            <div className="flex flex-wrap items-center gap-1.5">
              {row.isPublished ? (
                <SmallBadge tone="success">
                  {t('searchIndex.detail.published')}
                </SmallBadge>
              ) : (
                <SmallBadge tone="warning">
                  {t('searchIndex.detail.unpublished')}
                </SmallBadge>
              )}
              {row.hasPassword ? (
                <SmallBadge>
                  {t('searchIndex.detail.passwordProtected')}
                </SmallBadge>
              ) : null}
            </div>
          </Field>
          <Field label={t('searchIndex.detail.field.titleLength')}>
            <span className="tabular-nums">{row.titleLength}</span>
          </Field>
          <Field label={t('searchIndex.detail.field.bodyLength')}>
            <span className="tabular-nums">{row.bodyLength}</span>
          </Field>
          <Field label={t('searchIndex.detail.field.modifiedAt')}>
            {formatRelativeDate(row.modifiedAt, t)}
          </Field>
          <Field label={t('searchIndex.detail.field.createdAt')}>
            {formatRelativeDate(row.createdAt, t)}
          </Field>
          {row.publicAt ? (
            <Field label={t('searchIndex.detail.field.publicAt')}>
              {formatDateTime(row.publicAt)}
            </Field>
          ) : null}
        </div>
      </Scroll>
    </div>
  )
}
