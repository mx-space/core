import { useMemo } from 'react'

import { getProjects } from '~/api/projects'
import { useCollectionListQuery, useEntityList } from '~/data/resource/hooks'
import { projects } from '~/data/resources/project'
import { useUrlListState } from '~/features/_shared/hooks/use-url-list-state'
import { adminQueryKeys } from '~/query/keys'

import { projectsPageSize } from '../constants'
import { readPage } from '../utils/projects'

interface ProjectsListState {
  page: number
}

export function useProjectsList() {
  const urlStateOptions = useMemo(
    () => ({
      read: (searchParams: URLSearchParams): ProjectsListState => ({
        page: readPage(searchParams.get('page')),
      }),
      write: (state: ProjectsListState) => {
        const nextParams = new URLSearchParams()
        if (state.page > 1) nextParams.set('page', String(state.page))
        return nextParams
      },
    }),
    [],
  )

  const [state, setState] = useUrlListState(urlStateOptions)

  const projectsListKey = adminQueryKeys.projects.list({
    page: state.page,
    size: projectsPageSize,
  })

  const projectsQuery = useCollectionListQuery(projects, {
    queryFn: () => getProjects({ page: state.page, size: projectsPageSize }),
    queryKey: projectsListKey,
    toPage: (result) => ({
      items: result.data,
      pagination: result.pagination,
    }),
  })

  const projectsList = useEntityList(projects, projectsListKey, {
    keepPrevious: true,
  })

  return {
    page: state.page,
    pagination: projectsList.pagination,
    projects: projectsList.items,
    projectsQuery,
    setPage: (page: number) => setState({ page }),
  }
}
