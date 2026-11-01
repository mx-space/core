import { Loader2, Trash2 } from 'lucide-react'
import { Link } from 'react-router'

import type { PublishedUsage } from '~/api/content-usage'
import { formatBytes } from '~/features/files/utils/format'
import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { cn } from '~/utils/cn'

import type {
  ComponentCleanupCandidate,
  ComponentEntryReport,
  ComponentVersionReport,
} from '../utils/component-usage'

const EDITOR_PATH: Partial<Record<PublishedUsage['type'], string>> = {
  note: '/notes/edit',
  page: '/pages/edit',
  post: '/posts/edit',
}

export function ComponentVersionTimeline(props: {
  deletable: Map<string, ComponentCleanupCandidate>
  deletingKey: null | string
  onDeleteVersion: (candidate: ComponentCleanupCandidate) => void
  report: ComponentEntryReport
}) {
  const { t } = useI18n()
  const versions = props.report.versions
  const numbered = versions.map((version, index) => ({
    label: `v${index === 0 ? versions.length : index}`,
    version,
  }))
  const ordered = [numbered[0], ...numbered.slice(1).toReversed()]

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-fg">
        {t('dynamicComponents.timeline.title')}
      </h3>
      <ol className="relative flex flex-col gap-4 border-l border-border pl-5">
        {ordered.map(({ label, version }) => (
          <li className="relative" key={version.url}>
            <span
              className={cn(
                'absolute top-1.5 -left-[25px] size-2 rounded-full',
                version.current ? 'bg-accent' : 'bg-border-strong',
              )}
            />
            <div className="flex items-baseline gap-2 text-sm">
              <span className="font-semibold text-fg">{label}</span>
              <span className="text-xs text-fg-subtle">
                {version.current
                  ? `${t('dynamicComponents.timeline.current')} · `
                  : null}
                {formatBytes(version.bytes)}
              </span>
            </div>
            <div className="mt-1.5 truncate font-mono text-xs text-fg-subtle">
              {version.url}
            </div>
            <VersionUsers
              candidate={props.deletable.get(version.url)}
              deleting={
                props.deletingKey !== null &&
                props.deletable.get(version.url)?.key === props.deletingKey
              }
              onDelete={props.onDeleteVersion}
              version={version}
            />
          </li>
        ))}
      </ol>
    </section>
  )
}

function VersionUsers(props: {
  candidate?: ComponentCleanupCandidate
  deleting: boolean
  onDelete: (candidate: ComponentCleanupCandidate) => void
  version: ComponentVersionReport
}) {
  const { t } = useI18n()
  const usage = props.version.usage
  const published = usage?.published ?? []
  const drafts = usage?.drafts ?? []
  const other = usage?.other ?? []

  if (published.length + drafts.length + other.length === 0) {
    const candidate = props.candidate
    return (
      <div className="mt-2 flex items-center gap-3 text-xs text-fg-subtle">
        {usage?.historyOnly
          ? t('dynamicComponents.timeline.historyOnly')
          : t('dynamicComponents.timeline.noUsers')}
        {candidate ? (
          <Button
            className="h-7 px-2 text-xs text-red-600 dark:text-red-400"
            disabled={props.deleting}
            onClick={() => props.onDelete(candidate)}
            type="button"
            variant="subtle"
          >
            {props.deleting ? (
              <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
            ) : (
              <Trash2 aria-hidden="true" className="size-3.5" />
            )}
            {t('dynamicComponents.timeline.deleteVersion')}
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <ul className="mt-2 flex flex-col gap-1.5 text-sm">
      {published.map((item) => {
        const editor = EDITOR_PATH[item.type]
        return (
          <UsageRow
            key={`${item.type}:${item.id}`}
            kind={t(`dynamicComponents.timeline.type.${item.type}`)}
            title={item.title}
            to={
              editor ? `${editor}?id=${encodeURIComponent(item.id)}` : undefined
            }
          />
        )
      })}
      {drafts.map((item) => (
        <UsageRow
          key={`draft:${item.draftId}`}
          kind={
            item.live
              ? `${t('dynamicComponents.timeline.draft')} · ${t('dynamicComponents.timeline.live')}`
              : t('dynamicComponents.timeline.draft')
          }
          title={item.title}
          to={`/drafts/${item.draftId}`}
        />
      ))}
      {other.map((item) => (
        <UsageRow
          key={`${item.type}:${item.id}`}
          kind={t(`dynamicComponents.timeline.type.${item.type}`)}
          title={item.title}
        />
      ))}
      {!props.version.current ? (
        <li className="text-xs text-amber-700 dark:text-amber-400">
          {t('dynamicComponents.timeline.republishHint')}
        </li>
      ) : null}
    </ul>
  )
}

function UsageRow(props: { kind: string; title: string; to?: string }) {
  return (
    <li className="flex min-w-0 items-baseline justify-between gap-3">
      {props.to ? (
        <Link
          className="truncate text-fg hover:text-accent hover:underline"
          to={props.to}
        >
          {props.title}
        </Link>
      ) : (
        <span className="truncate text-fg">{props.title}</span>
      )}
      <span className="shrink-0 text-xs text-fg-subtle">{props.kind}</span>
    </li>
  )
}
