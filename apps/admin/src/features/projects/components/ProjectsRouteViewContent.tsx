import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Folder, Plus } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'

import { getProjects } from '~/api/projects'
import { APP_SHELL_HEADER_HEIGHT_CLASS } from '~/constants/layout'
import { useI18n } from '~/i18n'
import type { ProjectModel } from '~/models/project'
import { CompactPagination } from '~/ui/data/compact-pagination'
import { MasterDetailShell } from '~/ui/layout/master-detail-shell'
import { MobileHeaderAffordance } from '~/ui/layout/mobile-header-affordance'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { cn } from '~/utils/cn'

import { projectsPageSize, projectsQueryKey } from '../constants'
import { readPage } from '../utils/projects'
import { ProjectListItem } from './ProjectListItem'
import {
  ProjectEmptyState,
  ProjectListSkeleton,
  ProjectSelectPlaceholder,
} from './ProjectPrimitives'
import { ProjectsRouteContext } from './projects-route-context'

export function ProjectsRouteViewContent() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const params = useParams<{ id?: string }>()
  const detailId = params.id ?? null
  const isCreating = detailId === 'new'
  const selectedId = isCreating ? null : detailId
  const [searchParams, setSearchParams] = useSearchParams()
  const searchParamsKey = searchParams.toString()
  const [page, setPage] = useState(readPage(searchParams.get('page')))

  const projectsQuery = useQuery({
    placeholderData: (previous) => previous,
    queryFn: () => getProjects({ page, size: projectsPageSize }),
    queryKey: [...projectsQueryKey, 'list', page, projectsPageSize],
  })

  const projects = projectsQuery.data?.data ?? []
  const pagination = projectsQuery.data?.pagination

  useLayoutEffect(() => {
    const nextPage = readPage(searchParams.get('page'))
    setPage((value) => (value === nextPage ? value : nextPage))
  }, [searchParamsKey])

  useEffect(() => {
    const nextParams = new URLSearchParams()
    if (page > 1) nextParams.set('page', String(page))
    if (nextParams.toString() !== searchParamsKey) {
      setSearchParams(nextParams, { replace: true })
    }
  }, [page, searchParamsKey, setSearchParams])

  const invalidateProjects = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: projectsQueryKey })
  }, [queryClient])

  const buildListUrl = useCallback(() => {
    const qs = new URLSearchParams()
    if (page > 1) qs.set('page', String(page))
    const s = qs.toString()
    return `/projects${s ? `?${s}` : ''}`
  }, [page])

  const closeDetail = useCallback(() => {
    navigate(buildListUrl())
  }, [buildListUrl, navigate])

  const goEdit = useCallback(() => {
    if (!selectedId) return
    const sp = new URLSearchParams(searchParams)
    sp.set('edit', '1')
    navigate(`/projects/${selectedId}?${sp.toString()}`)
  }, [navigate, searchParams, selectedId])

  const stopEditing = useCallback(() => {
    if (!selectedId) return
    const sp = new URLSearchParams(searchParams)
    sp.delete('edit')
    const qs = sp.toString()
    navigate(`/projects/${selectedId}${qs ? `?${qs}` : ''}`)
  }, [navigate, searchParams, selectedId])

  const onCreated = useCallback(
    async (project: ProjectModel) => {
      const qs = searchParams.toString()
      navigate(`/projects/${project.id}${qs ? `?${qs}` : ''}`, {
        replace: true,
      })
      await invalidateProjects()
    },
    [invalidateProjects, navigate, searchParams],
  )

  const onSaved = useCallback(async () => {
    stopEditing()
    await invalidateProjects()
  }, [invalidateProjects, stopEditing])

  const onDeleted = useCallback(async () => {
    navigate(buildListUrl())
    await invalidateProjects()
  }, [buildListUrl, invalidateProjects, navigate])

  const openProject = useCallback(
    (project: ProjectModel) => {
      const qs = searchParams.toString()
      navigate(`/projects/${project.id}${qs ? `?${qs}` : ''}`)
    },
    [navigate, searchParams],
  )

  const startCreate = useCallback(() => {
    const qs = searchParams.toString()
    navigate(`/projects/new${qs ? `?${qs}` : ''}`)
  }, [navigate, searchParams])

  const routeContextValue = useMemo(
    () => ({
      onClose: closeDetail,
      onCreated,
      onDeleted,
      onEdit: goEdit,
      onMobileBack: closeDetail,
      onSaved,
      onStopEditing: stopEditing,
    }),
    [closeDetail, goEdit, onCreated, onDeleted, onSaved, stopEditing],
  )

  return (
    <ProjectsRouteContext.Provider value={routeContextValue}>
      <MasterDetailShell
        emptyDetail={<ProjectSelectPlaceholder />}
        list={
          <section className="flex h-full min-h-0 flex-col">
            <div
              className={cn(
                'flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-4 dark:border-neutral-800',
                APP_SHELL_HEADER_HEIGHT_CLASS,
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                <MobileHeaderAffordance />
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
              <Button onClick={startCreate} type="button" variant="subtle">
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
                    onSelect={() => openProject(project)}
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
      />
    </ProjectsRouteContext.Provider>
  )
}
