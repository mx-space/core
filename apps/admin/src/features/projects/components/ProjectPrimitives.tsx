import { Folder, Inbox } from 'lucide-react'

import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import type { ProjectModel } from '~/models/project'
import { MobileHeaderAffordance } from '~/ui/layout/mobile-header-affordance'
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
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <Inbox aria-hidden="true" className="mb-4 size-10 text-neutral-300" />
      <p className="text-sm text-neutral-500">{t('projects.empty.title')}</p>
      <p className="mt-1 text-xs text-neutral-400">
        {t('projects.empty.description')}
      </p>
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
    <section className="flex h-full min-h-0 flex-col bg-white dark:bg-neutral-950">
      <div
        className={cn(
          'flex shrink-0 items-center border-b border-neutral-200 px-4 dark:border-neutral-800',
          APP_SHELL_HEADER_HEIGHT_CLASS,
        )}
      >
        <MobileHeaderAffordance />
        <h2 className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">
          {t('projects.detailPlaceholder.heading')}
        </h2>
      </div>
      <div className="flex min-h-[32rem] flex-col items-center justify-center p-8 text-center">
        <Folder aria-hidden="true" className="mb-4 size-10 text-neutral-300" />
        <h2 className="text-sm font-medium">
          {t('projects.detailPlaceholder.title')}
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          {t('projects.detailPlaceholder.description')}
        </p>
      </div>
    </section>
  )
}
