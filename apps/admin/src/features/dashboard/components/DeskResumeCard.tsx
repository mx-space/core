import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'

import { refTypeMeta } from '~/features/drafts/constants'
import { useI18n } from '~/i18n'
import { Badge } from '~/ui/primitives/badge'
import { ButtonLink } from '~/ui/primitives/button'
import { relativeTimeFromNow } from '~/utils/time'

import type { DeskWritingItem } from '../utils/desk'
import { deskFocusClassName, DeskSection } from './DeskSection'
import { writingStatusMeta } from './DeskWritingCard'

export function DeskResumeCard(props: {
  className?: string
  item: DeskWritingItem
}) {
  const { format, t } = useI18n()
  const { item } = props
  const status = writingStatusMeta[item.status]

  return (
    <DeskSection
      className={props.className}
      title={`${t('dashboard.desk.resume.title')} · ${relativeTimeFromNow(item.time)}`}
    >
      <h3 className="text-balance text-xl font-semibold leading-snug text-fg phone:text-lg">
        <Link
          className={`text-fg transition-colors hover:text-accent ${deskFocusClassName}`}
          to={item.to}
        >
          {item.title || t('dashboard.desk.untitled')}
        </Link>
      </h3>
      {item.excerpt ? (
        <p className="mt-2 line-clamp-3 max-w-prose text-sm text-fg-muted">
          {item.excerpt}
        </p>
      ) : null}
      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-fg-subtle">
        <Badge size="sm" tone={refTypeMeta[item.refType].tone}>
          {t(refTypeMeta[item.refType].labelKey)}
        </Badge>
        <Badge size="sm" tone={status.tone}>
          {t(status.labelKey)}
        </Badge>
        {item.chars > 0 ? (
          <span className="tabular-nums">
            {t('dashboard.desk.resume.chars', {
              count: format.number(item.chars),
            })}
          </span>
        ) : null}
        {item.branchCount > 1 && item.draftId ? (
          <Link
            className={`tabular-nums transition-colors hover:text-accent ${deskFocusClassName}`}
            to={`/drafts/${item.draftId}`}
          >
            {t('dashboard.desk.writing.branches', { count: item.branchCount })}
          </Link>
        ) : null}
        <ButtonLink
          className="ml-auto phone:ml-0 phone:mt-1 phone:w-full"
          to={item.to}
        >
          {t('dashboard.desk.resume.continue')}
          <ArrowRight aria-hidden="true" className="size-4" />
        </ButtonLink>
      </div>
    </DeskSection>
  )
}
