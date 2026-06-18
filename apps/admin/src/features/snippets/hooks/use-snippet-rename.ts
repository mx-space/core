import type { QueryClient } from '@tanstack/react-query'
import { useMutation } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'

import { moveSnippet, type SnippetVfsList } from '~/api/snippets'
import type { TranslationKey, TranslationValues } from '~/i18n/types'
import { adminQueryKeys } from '~/query/keys'

import { getErrorMessage } from '../utils/snippets'

type Translator = (key: TranslationKey, values?: TranslationValues) => string

interface RenameMutationVars {
  from: string
  isFolder: boolean
  to: string
}

interface UseSnippetRenameArgs {
  queryClient: QueryClient
  t: Translator
}

interface UseSnippetRenameReturn {
  renamingPath: string | null
  pendingRenamePath: string | null
  startRename: (path: string) => void
  cancelRename: () => void
  commitRename: (oldPath: string, draft: string) => void
  isPending: boolean
}

function getParentPrefix(path: string) {
  const index = path.lastIndexOf('/')
  return index === -1 ? '' : path.slice(0, index + 1)
}

export function useSnippetRename(
  args: UseSnippetRenameArgs,
): UseSnippetRenameReturn {
  const { queryClient, t } = args
  const [renamingPath, setRenamingPath] = useState<string | null>(null)
  const vfsQueryKey = adminQueryKeys.snippets.vfs('', true)

  const renameMutation = useMutation<
    void,
    unknown,
    RenameMutationVars,
    { previous: SnippetVfsList | undefined }
  >({
    mutationFn: ({ from, isFolder, to }) =>
      moveSnippet({ from, recursive: isFolder, to }),
    onError: (error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(vfsQueryKey, context.previous)
      }
      toast.error(getErrorMessage(error, t('snippets.toast.renameConflict')))
    },
    onMutate: async ({ from, isFolder, to }) => {
      await queryClient.cancelQueries({ queryKey: vfsQueryKey })
      const previous = queryClient.getQueryData<SnippetVfsList>(vfsQueryKey)
      if (previous) {
        const patched: SnippetVfsList = {
          ...previous,
          objects: previous.objects.map((object) => {
            if (isFolder) {
              if (object.path.startsWith(from)) {
                return { ...object, path: to + object.path.slice(from.length) }
              }
              return object
            }
            if (object.path === from) {
              return { ...object, path: to }
            }
            return object
          }),
        }
        queryClient.setQueryData(vfsQueryKey, patched)
      }
      return { previous }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: vfsQueryKey })
    },
    onSuccess: () => {
      setRenamingPath(null)
    },
  })

  const commitRename = useCallback(
    (path: string, draftRaw: string) => {
      if (renameMutation.isPending) return
      const draft = draftRaw.trim()
      const isFolder = path.endsWith('/')
      const parentPrefix = isFolder
        ? getParentPrefix(path.slice(0, -1))
        : getParentPrefix(path)
      const originalSegment = isFolder
        ? path.slice(parentPrefix.length, -1)
        : path.slice(parentPrefix.length)

      if (!draft) {
        setRenamingPath(null)
        return
      }
      if (draft.includes('/')) {
        toast.error(t('snippets.toast.renameInvalid'))
        return
      }
      if (draft === originalSegment) {
        setRenamingPath(null)
        return
      }
      const to = isFolder
        ? `${parentPrefix}${draft}/`
        : `${parentPrefix}${draft}`
      renameMutation.mutate({ from: path, isFolder, to })
    },
    [renameMutation, t],
  )

  const cancelRename = useCallback(() => {
    setRenamingPath(null)
  }, [])

  const startRename = useCallback((path: string) => {
    setRenamingPath(path)
  }, [])

  const pendingRenamePath = renameMutation.isPending
    ? (renameMutation.variables?.from ?? null)
    : null

  return {
    cancelRename,
    commitRename,
    isPending: renameMutation.isPending,
    pendingRenamePath,
    renamingPath,
    startRename,
  }
}
