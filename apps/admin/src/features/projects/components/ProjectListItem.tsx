import { ExternalLink } from 'lucide-react'
import type { ProjectModel } from '~/models/project'

import { formatDate } from '../utils/projects'
import { ProjectAvatar } from './ProjectPrimitives'

export function ProjectListItem(props: {
  onSelect: () => void
  project: ProjectModel
  selected: boolean
}) {
  return (
    <button
      className={[
        'flex w-full items-center gap-3 border-b border-neutral-100 px-4 py-3 text-left transition-colors last:border-b-0 dark:border-neutral-800/60',
        props.selected
          ? 'bg-neutral-100 dark:bg-neutral-900'
          : 'hover:bg-neutral-50 dark:hover:bg-neutral-900/50',
      ].join(' ')}
      onClick={props.onSelect}
      type="button"
    >
      <ProjectAvatar project={props.project} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {props.project.name}
          </span>
          {props.project.projectUrl ? (
            <ExternalLink
              aria-hidden="true"
              className="size-3 shrink-0 text-neutral-400"
            />
          ) : null}
        </span>
        {props.project.description ? (
          <span className="mt-0.5 block truncate text-xs text-neutral-500 dark:text-neutral-400">
            {props.project.description}
          </span>
        ) : null}
        <time
          className="mt-1 block text-xs text-neutral-400"
          dateTime={props.project.createdAt}
        >
          {formatDate(props.project.createdAt)}
        </time>
      </span>
    </button>
  )
}
