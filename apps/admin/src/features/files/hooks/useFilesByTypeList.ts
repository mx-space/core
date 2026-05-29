import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import type { FileType } from '~/api/files'
import { getFilesByType } from '~/api/files'
import { useUrlListState } from '~/features/_shared/hooks/use-url-list-state'
import { adminQueryKeys } from '~/query/keys'

export function useFilesByTypeList() {
  const urlStateOptions = useMemo(
    () => ({
      read: (searchParams: URLSearchParams) => ({
        fileType: readFileType(searchParams.get('type')),
      }),
      write: (state: { fileType: FileType }) => {
        const nextParams = new URLSearchParams()
        nextParams.set('type', state.fileType)
        return nextParams
      },
    }),
    [],
  )

  const [state, setState] = useUrlListState(urlStateOptions)

  const filesQuery = useQuery({
    queryFn: () => getFilesByType(state.fileType),
    queryKey: adminQueryKeys.files.byType(state.fileType),
  })

  return {
    allFiles: filesQuery.data ?? [],
    fileType: state.fileType,
    filesQuery,
    setFileType: (fileType: FileType) => setState({ fileType }),
  }
}

function readFileType(value: null | string): FileType {
  return isFileType(value) ? value : 'icon'
}

function isFileType(value: null | string): value is FileType {
  return (
    value === 'avatar' ||
    value === 'file' ||
    value === 'icon' ||
    value === 'image'
  )
}
