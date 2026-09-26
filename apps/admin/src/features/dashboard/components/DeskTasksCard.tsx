import type { DeskSummary } from '~/api/aggregate'
import { useI18n } from '~/i18n'

import { writeClosedUpdateTip } from '../utils/dashboard'
import { presentDashboardUpgrade } from './DashboardUpgradeModal'
import { DeskItem, DeskRailSection } from './DeskSection'
import { presentUpdateRelease } from './UpdateReleaseModal'

export function DeskTasksCard(props: {
  adminUpdate: null | string
  adminVersion: string
  className?: string
  desk?: DeskSummary
  systemUpdate: null | string
  systemVersion: string
}) {
  const { t } = useI18n()
  const { adminUpdate, adminVersion, systemUpdate, systemVersion } = props
  const comments = props.desk?.unreadComments
  const links = props.desk?.linkApplications

  return (
    <DeskRailSection
      className={props.className}
      title={t('dashboard.desk.tasks.title')}
    >
      {comments && comments.count > 0 ? (
        <DeskTaskRow
          count={comments.count}
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
    </DeskRailSection>
  )
}

function DeskTaskRow(props: {
  count: number
  label: string
  onClick?: () => void
  preview: null | string
  to?: string
}) {
  const { format } = useI18n()

  return (
    <DeskItem
      className="border-b border-border py-3 first:pt-0 last:border-b-0"
      onClick={props.onClick}
      to={props.to}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate text-sm font-medium text-fg transition-colors group-hover:text-accent">
          {props.label}
        </span>
        <span className="ml-auto shrink-0 rounded-full bg-accent-soft px-1.5 text-xs font-medium tabular-nums text-accent">
          {format.number(props.count)}
        </span>
      </span>
      {props.preview ? (
        <span className="mt-0.5 block truncate text-xs text-fg-subtle">
          {props.preview}
        </span>
      ) : null}
    </DeskItem>
  )
}
