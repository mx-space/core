import { useEffect, useMemo, useState } from 'react'
import type { FileRowItem } from '../utils/adapters'

interface UseFileSearchResult<T> {
  items: FileRowItem<T>[]
  query: string
  setQuery: (value: string) => void
  deferredQuery: string
}

export function useFileSearch<T>(
  source: FileRowItem<T>[],
  delayMs = 100,
): UseFileSearchResult<T> {
  const [query, setQuery] = useState('')
  const [deferredQuery, setDeferredQuery] = useState('')

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed === deferredQuery) return
    const handle = setTimeout(() => setDeferredQuery(trimmed), delayMs)
    return () => clearTimeout(handle)
  }, [query, deferredQuery, delayMs])

  const items = useMemo(() => {
    if (!deferredQuery) return source
    const needle = deferredQuery.toLowerCase()
    return source.filter((item) => {
      const fields = [item.primary, item.secondary, item.tertiary]
      return fields.some(
        (field) =>
          typeof field === 'string' && field.toLowerCase().includes(needle),
      )
    })
  }, [source, deferredQuery])

  return { items, query, setQuery, deferredQuery }
}
