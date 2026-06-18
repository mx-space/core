import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'

import {
  deleteSnippet,
  deleteSnippetByPath,
  moveSnippet,
  type SnippetVfsList,
} from '~/api/snippets'
import { adminQueryKeys } from '~/query/keys'

export interface SettleResult {
  failed: Array<{ error: Error; path: string }>
  ok: number
}

interface MoveArgs {
  from: string
  recursive: boolean
  to: string
}

function isFolderPath(path: string) {
  return path.endsWith('/')
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value))
}

export function useSnippetVfs() {
  const queryClient = useQueryClient()
  const queryKey = useMemo(() => adminQueryKeys.snippets.vfs('', true), [])

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey }),
    [queryClient, queryKey],
  )

  const resolveFileId = useCallback(
    (path: string) => {
      const list = queryClient.getQueryData<SnippetVfsList>(queryKey)
      return list?.objects.find((object) => object.path === path)?.id ?? null
    },
    [queryClient, queryKey],
  )

  const rename = useCallback(
    async (args: MoveArgs) => {
      try {
        await moveSnippet(args)
      } finally {
        await invalidate()
      }
    },
    [invalidate],
  )

  const move = useCallback(
    async (args: MoveArgs) => {
      try {
        await moveSnippet(args)
      } finally {
        await invalidate()
      }
    },
    [invalidate],
  )

  const batchMove = useCallback(
    async (
      moves: Array<{ from: string; to: string }>,
    ): Promise<SettleResult> => {
      const settled = await Promise.allSettled(
        moves.map((entry) =>
          moveSnippet({
            from: entry.from,
            recursive: isFolderPath(entry.from),
            to: entry.to,
          }),
        ),
      )
      const failed: SettleResult['failed'] = []
      let ok = 0
      settled.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          ok += 1
        } else {
          failed.push({
            error: toError(result.reason),
            path: moves[index].from,
          })
        }
      })
      await invalidate()
      return { failed, ok }
    },
    [invalidate],
  )

  const batchDelete = useCallback(
    async (paths: string[]): Promise<SettleResult> => {
      const settled = await Promise.allSettled(
        paths.map((path) => {
          if (isFolderPath(path)) {
            return deleteSnippetByPath(path, true)
          }
          const id = resolveFileId(path)
          if (!id) {
            return Promise.reject(new Error(`Snippet not found: ${path}`))
          }
          return deleteSnippet(id)
        }),
      )
      const failed: SettleResult['failed'] = []
      let ok = 0
      settled.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          ok += 1
        } else {
          failed.push({ error: toError(result.reason), path: paths[index] })
        }
      })
      await invalidate()
      return { failed, ok }
    },
    [invalidate, resolveFileId],
  )

  return { batchDelete, batchMove, move, rename }
}
