import { Folder, Plus } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'

import { ContentListHeader } from '~/features/_shared/components/content-list-toolbar'
import { useI18n } from '~/i18n'
import type { ProjectModel } from '~/models/project'
import { CompactPagination } from '~/ui/data/compact-pagination'
import { MasterDetailShell } from '~/ui/layout/master-detail-shell'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'

import { projectsPageSize } from '../constants'
import { useProjectMutations } from '../hooks/use-project-mutations'
import { useProjectsList } from '../hooks/use-projects-list'
import { ProjectListItem } from './ProjectListItem'
import {
  ProjectEmptyState,
  ProjectListSkeleton,
  ProjectSelectPlaceholder,
} from './ProjectPrimitives'
import { ProjectsRouteContext } from './projects-route-context'

export function ProjectsRouteViewContent() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const params = useParams<{ id?: string }>()
  const detailId = params.id ?? null
  const isCreating = detailId === 'new'
  const selectedId = isCreating ? null : detailId
  const [searchParams] = useSearchParams()
  const { page, pagination, projects, projectsQuery, setPage } =
    useProjectsList()
  const { invalidateProjects } = useProjectMutations()

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
  }, [buildListUrl, navigate])

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
            <ContentListHeader
              action={
                <Button onClick={startCreate} type="button" variant="subtle">
                  <Plus aria-hidden="true" className="size-4" />
                  {t('projects.create')}
                </Button>
              }
              count={
                pagination
                  ? t('projects.countLabel', { count: pagination.total })
                  : null
              }
              icon={<Folder aria-hidden="true" className="size-4" />}
              title={t('projects.title')}
            />

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
