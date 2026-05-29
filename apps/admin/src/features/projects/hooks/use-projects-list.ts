import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { getProjects } from '~/api/projects'
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

  const projectsQuery = useQuery({
    placeholderData: (previous) => previous,
    queryFn: () => getProjects({ page: state.page, size: projectsPageSize }),
    queryKey: adminQueryKeys.projects.list({
      page: state.page,
      size: projectsPageSize,
    }),
  })

  return {
    page: state.page,
    pagination: projectsQuery.data?.pagination,
    projects: projectsQuery.data?.data ?? [],
    projectsQuery,
    setPage: (page: number) => setState({ page }),
  }
}
