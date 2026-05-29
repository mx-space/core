import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import type { CommentUploadStatus } from '~/api/files'
import { getCommentUploads } from '~/api/files'
import { useUrlListState } from '~/features/_shared/hooks/use-url-list-state'
import { adminQueryKeys } from '~/query/keys'

import { FILES_PAGE_SIZE } from '../constants'

interface CommentImagesListState {
  page: number
  status: CommentUploadStatus
}

export function useCommentImagesList() {
  const urlStateOptions = useMemo(
    () => ({
      read: (searchParams: URLSearchParams): CommentImagesListState => ({
        page: readPositivePage(searchParams.get('page')),
        status: readStatus(searchParams.get('status')),
      }),
      write: (state: CommentImagesListState) => {
        const nextParams = new URLSearchParams()
        if (state.status) nextParams.set('status', state.status)
        if (state.page > 1) nextParams.set('page', String(state.page))
        return nextParams
      },
    }),
    [],
  )

  const [state, setState] = useUrlListState(urlStateOptions)

  const commentsQuery = useQuery({
    placeholderData: (previous) => previous,
    queryFn: () =>
      getCommentUploads({
        page: state.page,
        size: FILES_PAGE_SIZE,
        status: state.status === '' ? undefined : state.status,
      }),
    queryKey: adminQueryKeys.files.commentUploads({
      page: state.page,
      size: FILES_PAGE_SIZE,
      status: state.status,
    }),
  })

  return {
    comments: commentsQuery.data?.data ?? [],
    commentsQuery,
    page: state.page,
    pageCount: commentsQuery.data?.pagination.totalPage ?? 1,
    setPage: (page: number) => setState({ page }),
    setStatus: (status: CommentUploadStatus) =>
      setState((current) => ({ ...current, page: 1, status })),
    status: state.status,
    total: commentsQuery.data?.pagination.total ?? 0,
  }
}

function readPositivePage(value: null | string) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
}

function readStatus(value: null | string): CommentUploadStatus {
  return isStatus(value) ? (value ?? '') : ''
}

function isStatus(value: null | string): value is CommentUploadStatus {
  return (
    value === '' ||
    value === null ||
    value === 'active' ||
    value === 'detached' ||
    value === 'pending'
  )
}
