import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { ProjectModel } from '~/models/project'

import { deleteProject } from '~/api/projects'
import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { MarkdownRender } from '~/ui/primitives/markdown-render'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'
import { relativeTimeFromNow } from '~/utils/time'

import { ProjectImageGrid } from './ProjectImageGrid'
import { ProjectLinks } from './ProjectLinks'
import { ProjectAvatar } from './ProjectPrimitives'

export function ProjectDetailPanel(props: {
  onClose: () => void
  onDeleted: () => Promise<void>
  onEdit: () => void
  onMobileBack: () => void
  project: ProjectModel
}) {
  const { t } = useI18n()
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const deleteMutation = useMutation({
    mutationFn: deleteProject,
    onSuccess: async () => {
      toast.success(t('projects.detail.deleteSuccess'))
      await props.onDeleted()
    },
  })

  const images = props.project.images?.filter(Boolean) ?? []

  return (
    <section className="flex h-full min-h-0 flex-col bg-white dark:bg-neutral-950">
      <div
        className={cn(
          'flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-4 dark:border-neutral-800',
          APP_SHELL_HEADER_HEIGHT_CLASS,
        )}
      >
        <div className="min-w-0">
          <h2 className="inline-flex min-w-0 items-center gap-2 text-lg font-semibold text-neutral-950 dark:text-neutral-50">
            <ProjectAvatar project={props.project} size="small" />
            <span className="truncate">{props.project.name}</span>
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            className="lg:hidden"
            onClick={props.onMobileBack}
            type="button"
            variant="subtle"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            {t('projects.detail.return')}
          </Button>
          <Button
            className="hidden lg:inline-flex"
            onClick={props.onClose}
            type="button"
            variant="subtle"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            {t('projects.detail.close')}
          </Button>
          <Button onClick={props.onEdit} type="button" variant="subtle">
            <Pencil aria-hidden="true" className="size-4" />
            {t('projects.detail.edit')}
          </Button>
          <Button
            className="text-red-600 hover:text-red-700 dark:text-red-400"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (isConfirmingDelete) {
                deleteMutation.mutate(props.project.id)
              } else {
                setIsConfirmingDelete(true)
              }
            }}
            onMouseLeave={() => setIsConfirmingDelete(false)}
            type="button"
            variant="subtle"
          >
            <Trash2 aria-hidden="true" className="size-4" />
            {isConfirmingDelete
              ? t('projects.detail.confirmDelete')
              : t('projects.detail.delete')}
          </Button>
        </div>
      </div>

      <Scroll className="flex-1">
        <div className="mx-auto grid max-w-3xl gap-6 p-6">
          <div className="flex items-start gap-4">
            <ProjectAvatar project={props.project} size="large" />
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">
                {props.project.name}
              </h3>
              {props.project.description ? (
                <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
                  {props.project.description}
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-neutral-400">
                <time dateTime={props.project.createdAt}>
                  {t('projects.detail.createdAt', {
                    time: relativeTimeFromNow(props.project.createdAt),
                  })}
                </time>
              </div>
            </div>
          </div>

          <ProjectLinks project={props.project} />

          {images.length > 0 ? <ProjectImageGrid images={images} /> : null}

          {props.project.text ? (
            <section className="border-t border-neutral-100 pt-5 dark:border-neutral-800">
              <h4 className="mb-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                {t('projects.detail.introTitle')}
              </h4>
              <MarkdownRender text={props.project.text} />
            </section>
          ) : (
            <p className="border-t border-neutral-100 pt-5 text-sm text-neutral-500 dark:border-neutral-800">
              {t('projects.detail.introEmpty')}
            </p>
          )}
        </div>
      </Scroll>
    </section>
  )
}
