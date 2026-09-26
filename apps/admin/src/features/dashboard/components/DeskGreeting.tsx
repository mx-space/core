import { NotebookPen, PenLine, Zap } from 'lucide-react'
import type { ReactNode } from 'react'
import { Fragment, useMemo } from 'react'
import { Link } from 'react-router'

import type { DeskSummary } from '~/api/aggregate'
import { useI18n } from '~/i18n'
import { MobileHeaderAffordance } from '~/ui/layout/mobile-header-affordance'
import { ButtonLink } from '~/ui/primitives/button'
import { cn } from '~/utils/cn'

import { resolveGreetingKey } from '../utils/desk'
import { deskFocusClassName } from './DeskSection'

const actionClassName =
  'phone:bg-surface-inset phone:text-fg phone:hover:bg-surface-inset'

export function DeskGreeting(props: {
  className?: string
  desk?: DeskSummary
  online?: number
  ownerName?: string
  todayMaxOnline?: number
}) {
  const { format, t } = useI18n()
  const now = useMemo(() => new Date(), [])
  const greeting = t(resolveGreetingKey(now.getHours()))

  return (
    <header className={cn('pb-8 phone:pb-6', props.className)}>
      <div className="flex min-w-0 items-center gap-2">
        <MobileHeaderAffordance />
        <p className="truncate text-xs tabular-nums text-fg-subtle">
          {format.dateTime(now, { dateStyle: 'full', timeStyle: undefined })}
          <span className="phone:hidden">
            {' · '}
            {t('dashboard.desk.greeting.live', {
              max: format.number(props.todayMaxOnline ?? 0),
              online: format.number(props.online ?? 0),
            })}
          </span>
        </p>
      </div>
      <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight text-fg phone:text-2xl">
        {props.ownerName
          ? t('dashboard.desk.greeting.withName', {
              greeting,
              name: props.ownerName,
            })
          : greeting}
      </h1>
      {props.desk ? <DeskSummaryLine desk={props.desk} /> : null}
      <div className="-ml-3 mt-4 flex flex-wrap gap-1 phone:ml-0 phone:grid phone:grid-cols-3 phone:gap-2">
        <ButtonLink
          className={actionClassName}
          to="/posts/edit"
          variant="ghost"
        >
          <PenLine aria-hidden="true" className="size-4" />
          {t('dashboard.desk.action.post')}
        </ButtonLink>
        <ButtonLink
          className={actionClassName}
          to="/notes/edit"
          variant="ghost"
        >
          <NotebookPen aria-hidden="true" className="size-4" />
          {t('dashboard.desk.action.note')}
        </ButtonLink>
        <ButtonLink
          className={actionClassName}
          to="/recently?create=1"
          variant="ghost"
        >
          <Zap aria-hidden="true" className="size-4" />
          {t('dashboard.desk.action.recently')}
        </ButtonLink>
      </div>
    </header>
  )
}

function DeskSummaryLine(props: { desk: DeskSummary }) {
  const { format, t } = useI18n()
  const { linkApplications, scheduledNotes, unreadComments } = props.desk
  const nextScheduled = scheduledNotes.reduce<
    DeskSummary['scheduledNotes'][number] | undefined
  >(
    (earliest, note) =>
      !earliest || note.publicAt < earliest.publicAt ? note : earliest,
    undefined,
  )

  const clauses: ReactNode[] = []
  if (unreadComments.count > 0) {
    clauses.push(
      <SummaryLink key="comments" to="/comments?state=0">
        {t('dashboard.desk.summary.comments', { count: unreadComments.count })}
      </SummaryLink>,
    )
  }
  if (linkApplications.count > 0) {
    clauses.push(
      <SummaryLink key="links" to="/friends?state=1">
        {t('dashboard.desk.summary.links', { count: linkApplications.count })}
      </SummaryLink>,
    )
  }
  if (nextScheduled) {
    clauses.push(
      <SummaryLink
        key="scheduled"
        to={`/notes/edit?id=${encodeURIComponent(nextScheduled.id)}`}
      >
        {t('dashboard.desk.summary.scheduled', {
          time: format.dateTime(nextScheduled.publicAt, {
            dateStyle: 'medium',
            timeStyle: 'short',
          }),
          title: nextScheduled.title || t('dashboard.desk.untitled'),
        })}
      </SummaryLink>,
    )
  }

  return (
    <p className="mt-2 max-w-prose text-sm text-fg-muted">
      {clauses.length === 0
        ? t('dashboard.desk.summary.clear')
        : clauses.map((clause, index) => (
            <Fragment key={index}>
              {index > 0 ? t('dashboard.desk.summary.separator') : null}
              {clause}
            </Fragment>
          ))}
      {clauses.length > 0 ? t('dashboard.desk.summary.end') : null}
    </p>
  )
}

function SummaryLink(props: { children: ReactNode; to: string }) {
  return (
    <Link
      className={`border-b border-border-strong text-fg transition-colors hover:border-accent hover:text-accent ${deskFocusClassName}`}
      to={props.to}
    >
      {props.children}
    </Link>
  )
}
