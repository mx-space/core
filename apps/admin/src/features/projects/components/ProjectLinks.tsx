import { Code2, ExternalLink } from 'lucide-react'
import type { ProjectModel } from '~/models/project'

import { useI18n } from '~/i18n'

export function ProjectLinks(props: { project: ProjectModel }) {
  const { t } = useI18n()
  const links = [
    [t('projects.links.source'), props.project.projectUrl, Code2],
    [t('projects.links.preview'), props.project.previewUrl, ExternalLink],
    [t('projects.links.docs'), props.project.docUrl, ExternalLink],
  ] as const

  return (
    <div className="flex flex-wrap gap-2 border-t border-neutral-100 pt-5 dark:border-neutral-800">
      {links.map(([label, href, Icon]) =>
        href ? (
          <a
            className="inline-flex h-8 items-center gap-1.5 rounded bg-neutral-100 px-3 text-xs text-neutral-700 transition-colors hover:bg-neutral-200 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
            href={href}
            key={label}
            rel="noreferrer"
            target="_blank"
          >
            <Icon aria-hidden="true" className="size-3.5" />
            {label}
          </a>
        ) : null,
      )}
    </div>
  )
}
