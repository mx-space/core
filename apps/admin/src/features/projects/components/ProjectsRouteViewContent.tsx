import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Folder, Plus } from 'lucide-react'
import { useEffect, useLayoutEffect, useState } from 'react'
import { useSearchParams } from 'react-router'

import { getProject, getProjects } from '~/api/projects'
import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import { CompactPagination } from '~/ui/data/compact-pagination'
import { MasterDetailLayout } from '~/ui/layout/page-layout'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'

import { projectsPageSize, projectsQueryKey } from '../constants'
import { readPage } from '../utils/projects'
import { ProjectListItem } from './ProjectListItem'
import { ProjectEmptyState, ProjectListSkeleton } from './ProjectPrimitives'
import { ProjectWorkspace } from './ProjectWorkspace'

export function ProjectsRouteViewContent() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const searchParamsKey = searchParams.toString()
  const [page, setPage] = useState(readPage(searchParams.get('page')))
  const [selectedId, setSelectedId] = useState<string | null>(
    searchParams.get('id'),
  )
  const [isCreating, setIsCreating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [showDetailOnMobile, setShowDetailOnMobile] = useState(false)

  const projectsQuery = useQuery({
    placeholderData: (previous) => previous,
    queryFn: () => getProjects({ page, size: projectsPageSize }),
    queryKey: [...projectsQueryKey, 'list', page, projectsPageSize],
  })
  const projectQuery = useQuery({
    enabled: Boolean(selectedId) && !isCreating,
    queryFn: () => getProject(selectedId!),
    queryKey: [...projectsQueryKey, 'detail', selectedId],
  })

  const projects = projectsQuery.data?.data ?? []
  const pagination = projectsQuery.data?.pagination

  useLayoutEffect(() => {
    const nextPage = readPage(searchParams.get('page'))
    const nextSelectedId = searchParams.get('id')

    setPage((value) => (value === nextPage ? value : nextPage))
    setSelectedId((value) =>
      value === nextSelectedId ? value : nextSelectedId,
    )

    if (nextSelectedId) {
      setIsCreating(false)
      setIsEditing(false)
      setShowDetailOnMobile(true)
    } else if (!isCreating) {
      setIsEditing(false)
      setShowDetailOnMobile(false)
    }
  }, [isCreating, searchParamsKey])

  useEffect(() => {
    const nextParams = new URLSearchParams()
    if (page > 1) nextParams.set('page', String(page))
    if (selectedId) nextParams.set('id', selectedId)
    if (nextParams.toString() !== searchParamsKey) {
      setSearchParams(nextParams, { replace: true })
    }
  }, [page, searchParamsKey, selectedId, setSearchParams])

  const invalidateProjects = async () => {
    await queryClient.invalidateQueries({ queryKey: projectsQueryKey })
  }

  return (
    <MasterDetailLayout
      list={
        <section className="flex h-full min-h-0 flex-col">
          <div
            className={cn(
              'flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-4 dark:border-neutral-800',
              APP_SHELL_HEADER_HEIGHT_CLASS,
            )}
          >
            <div className="min-w-0">
              <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-neutral-950 dark:text-neutral-50">
                <Folder aria-hidden="true" className="size-4" />
                {t('projects.title')}
              </h2>
            </div>
            {pagination ? (
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                {t('projects.countLabel', { count: pagination.total })}
              </span>
            ) : null}
            <Button
              onClick={() => {
                setSelectedId(null)
                setIsEditing(false)
                setIsCreating(true)
                setShowDetailOnMobile(true)
              }}
              type="button"
              variant="subtle"
            >
              <Plus aria-hidden="true" className="size-4" />
              {t('projects.create')}
            </Button>
          </div>

          <Scroll className="flex-1">
            {projectsQuery.isLoading && projects.length === 0 ? (
              <ProjectListSkeleton />
            ) : projects.length === 0 ? (
              <ProjectEmptyState />
            ) : (
              projects.map((project) => (
                <ProjectListItem
                  key={project.id}
                  onSelect={() => {
                    setSelectedId(project.id)
                    setIsCreating(false)
                    setIsEditing(false)
                    setShowDetailOnMobile(true)
                  }}
                  project={project}
                  selected={selectedId === project.id}
                />
              ))
            )}
          </Scroll>

          {pagination && pagination.totalPages > 1 ? (
            <div className="shrink-0 border-t border-neutral-200 p-3 dark:border-neutral-800">
              <CompactPagination
                onPageChange={setPage}
                onPageSizeChange={() => undefined}
                page={page}
                pageCount={pagination.totalPages}
                pageSize={projectsPageSize}
                pageSizes={[projectsPageSize]}
              />
            </div>
          ) : null}
        </section>
      }
      showDetailOnMobile={showDetailOnMobile}
      detail={
        <ProjectWorkspace
          isCreating={isCreating}
          isEditing={isEditing}
          onClose={() => {
            setSelectedId(null)
            setIsCreating(false)
            setIsEditing(false)
            setShowDetailOnMobile(false)
          }}
          onMobileBack={() => setShowDetailOnMobile(false)}
          onCreated={async (project) => {
            setIsCreating(false)
            setSelectedId(project.id)
            setShowDetailOnMobile(true)
            await invalidateProjects()
          }}
          onDeleted={async () => {
            setSelectedId(null)
            setIsCreating(false)
            setIsEditing(false)
            setShowDetailOnMobile(false)
            await invalidateProjects()
          }}
          onEdit={() => setIsEditing(true)}
          onSaved={async () => {
            setIsEditing(false)
            await invalidateProjects()
          }}
          onStopEditing={() => setIsEditing(false)}
          project={projectQuery.data ?? null}
          projectLoading={projectQuery.isLoading}
          selectedId={selectedId}
          showDetailOnMobile={showDetailOnMobile}
        />
      }
    />
  )
}
