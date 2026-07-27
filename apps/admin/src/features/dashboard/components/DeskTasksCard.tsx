import type { LucideIcon } from 'lucide-react'
import { ArrowUpCircle, ChevronRight, Link2, MessageSquare } from 'lucide-react'

import type { DeskSummary } from '~/api/aggregate'
import { useI18n } from '~/i18n'

import { writeClosedUpdateTip } from '../utils/dashboard'
import { presentDashboardUpgrade } from './DashboardUpgradeModal'
import { DeskCard, DeskRow } from './DeskCard'
import { presentUpdateRelease } from './UpdateReleaseModal'

export function DeskTasksCard(props: {
  adminUpdate: null | string
  adminVersion: string
  desk?: DeskSummary
  systemUpdate: null | string
  systemVersion: string
}) {
  const { t } = useI18n()
  const { adminUpdate, adminVersion, systemUpdate, systemVersion } = props
  const comments = props.desk?.unreadComments
  const links = props.desk?.linkApplications

  return (
    <DeskCard title={t('dashboard.desk.tasks.title')}>
      {comments && comments.count > 0 ? (
        <DeskTaskRow
          count={comments.count}
          icon={MessageSquare}
          label={t('dashboard.desk.task.comments')}
          preview={
            comments.latest
              ? t('dashboard.desk.task.commentPreview', {
                  author: comments.latest.author,
                  text: comments.latest.text,
                })
              : null
          }
          to="/comments?state=0"
        />
      ) : null}
      {links && links.count > 0 ? (
        <DeskTaskRow
          count={links.count}
          icon={Link2}
          label={t('dashboard.desk.task.links')}
          preview={
            links.latest
              ? t('dashboard.desk.task.linkPreview', {
                  name: links.latest.name,
                  url: links.latest.url,
                })
              : null
          }
          to="/friends?state=1"
        />
      ) : null}
      {systemUpdate ? (
        <DeskTaskRow
          count={1}
          icon={ArrowUpCircle}
          label={t('dashboard.desk.task.serverUpdate')}
          onClick={() => {
            writeClosedUpdateTip('system', systemUpdate)
            presentUpdateRelease({
              repo: 'mx-server',
              title: t('dashboard.release.systemTitle'),
              version: systemUpdate,
            })
          }}
          preview={t('dashboard.desk.task.updatePreview', {
            current: systemVersion,
            latest: systemUpdate,
          })}
        />
      ) : null}
      {adminUpdate ? (
        <DeskTaskRow
          count={1}
          icon={ArrowUpCircle}
          label={t('dashboard.desk.task.adminUpdate')}
          onClick={() => {
            writeClosedUpdateTip('dashboard', adminUpdate)
            presentDashboardUpgrade()
          }}
          preview={t('dashboard.desk.task.updatePreview', {
            current: adminVersion,
            latest: adminUpdate,
          })}
        />
      ) : null}
    </DeskCard>
  )
}

function DeskTaskRow(props: {
  count: number
  icon: LucideIcon
  label: string
  onClick?: () => void
  preview: null | string
  to?: string
}) {
  const { format } = useI18n()
  const Icon = props.icon

  return (
    <DeskRow onClick={props.onClick} to={props.to}>
      <Icon aria-hidden="true" className="size-4 shrink-0 text-fg-subtle" />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm text-fg">{props.label}</span>
          <span className="shrink-0 rounded-full bg-accent-soft px-1.5 text-xs font-medium tabular-nums text-accent">
            {format.number(props.count)}
          </span>
        </span>
        {props.preview ? (
          <span className="mt-0.5 block truncate text-xs text-fg-muted">
            {props.preview}
          </span>
        ) : null}
      </span>
      <ChevronRight
        aria-hidden="true"
        className="size-4 shrink-0 text-fg-subtle"
      />
    </DeskRow>
  )
}
