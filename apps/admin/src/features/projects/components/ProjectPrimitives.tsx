import { Folder, Inbox } from 'lucide-react'

import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import type { ProjectModel } from '~/models/project'
import { MobileHeaderAffordance } from '~/ui/layout/mobile-header-affordance'
import { EmptyState } from '~/ui/patterns/EmptyState'
import { cn } from '~/utils/cn'

import type { ProjectAvatarSize } from '../types/projects'
import { readInitial } from '../utils/projects'

export function ProjectAvatar(props: {
  project: Pick<ProjectModel, 'avatar' | 'name'>
  size?: ProjectAvatarSize
}) {
  const sizeClass =
    props.size === 'large'
      ? 'size-14 text-xl'
      : props.size === 'small'
        ? 'size-6 text-xs'
        : 'size-10 text-sm'

  if (props.project.avatar) {
    return (
      <img
        alt=""
        className={`${sizeClass} shrink-0 rounded-full object-cover ring-1 ring-neutral-200 dark:ring-neutral-700`}
        src={props.project.avatar}
      />
    )
  }

  return (
    <span
      className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full bg-neutral-100 font-semibold uppercase text-neutral-600 ring-1 ring-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:ring-neutral-700`}
    >
      {readInitial(props.project.name)}
    </span>
  )
}

export function ProjectEmptyState() {
  const { t } = useI18n()
  return (
    <div className="flex items-center justify-center py-24">
      <EmptyState
        description={t('projects.empty.description')}
        icon={Inbox}
        title={t('projects.empty.title')}
      />
    </div>
  )
}

export function ProjectListSkeleton() {
  return (
    <div className="animate-pulse p-4">
      {[1, 2, 3, 4, 5].map((index) => (
        <div className="mb-4 flex gap-3" key={index}>
          <div className="size-10 rounded-full bg-neutral-200 dark:bg-neutral-800" />
          <div className="flex-1">
            <div className="h-4 w-2/3 rounded bg-neutral-200 dark:bg-neutral-800" />
            <div className="mt-2 h-3 w-full rounded bg-neutral-100 dark:bg-neutral-900" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ProjectDetailSkeleton() {
  return (
    <section className="flex h-full min-h-0 flex-col bg-white dark:bg-neutral-950">
      <div
        className={cn(
          'flex shrink-0 items-center border-b border-neutral-200 px-4 dark:border-neutral-800',
          APP_SHELL_HEADER_HEIGHT_CLASS,
        )}
      >
        <MobileHeaderAffordance />
        <h2 className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">
          Loading project
        </h2>
      </div>
      <div className="animate-pulse p-6">
        <div className="h-6 w-40 rounded bg-neutral-200 dark:bg-neutral-800" />
        <div className="mt-4 h-4 w-full rounded bg-neutral-100 dark:bg-neutral-900" />
        <div className="mt-2 h-4 w-4/5 rounded bg-neutral-100 dark:bg-neutral-900" />
        <div className="mt-8 h-72 rounded bg-neutral-100 dark:bg-neutral-900" />
      </div>
    </section>
  )
}

export function ProjectSelectPlaceholder() {
  const { t } = useI18n()
  return (
    <section className="flex h-full min-h-0 flex-col bg-surface-card">
      <div
        className={cn(
          'flex shrink-0 items-center border-b border-border px-4',
          APP_SHELL_HEADER_HEIGHT_CLASS,
        )}
      >
        <MobileHeaderAffordance />
        <h2 className="text-lg font-semibold text-fg">
          {t('projects.detailPlaceholder.heading')}
        </h2>
      </div>
      <div className="flex min-h-[32rem] items-center justify-center p-8">
        <EmptyState
          description={t('projects.detailPlaceholder.description')}
          icon={Folder}
          title={t('projects.detailPlaceholder.title')}
        />
      </div>
    </section>
  )
}
