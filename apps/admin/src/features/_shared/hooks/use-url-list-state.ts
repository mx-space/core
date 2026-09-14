import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { useSearchParams } from 'react-router'

type StateUpdater<TState> = Partial<TState> | ((current: TState) => TState)

interface UseUrlListStateOptions<TState extends object> {
  read: (searchParams: URLSearchParams) => TState
  write: (state: TState) => URLSearchParams
}

export function useUrlListState<TState extends object>(
  options: UseUrlListStateOptions<TState>,
) {
  const [searchParams, setSearchParams] = useSearchParams()
  const searchParamsKey = searchParams.toString()
  const [state, setState] = useState(() => options.read(searchParams))

  useLayoutEffect(() => {
    const nextState = options.read(searchParams)
    setState((current) =>
      shallowEqualRecord(current, nextState) ? current : nextState,
    )
  }, [options, searchParams, searchParamsKey])

  useEffect(() => {
    const written = options.write(state)
    const nextParams = mergeListSearchParams(
      searchParams,
      written,
      collectOwnedSearchParamKeys(options.read, searchParams, written),
    )
    if (!searchParamsEqual(nextParams, searchParams)) {
      setSearchParams(nextParams, { replace: true })
    }
  }, [options, searchParams, searchParamsKey, setSearchParams, state])

  const updateState = useCallback((updater: StateUpdater<TState>) => {
    setState((current) => {
      if (typeof updater === 'function') return updater(current)
      return { ...current, ...updater }
    })
  }, [])

  return [state, updateState] as const
}

/**
 * List writers only serialize their own fields (often omitting defaults).
 * Overlay those fields onto the current search string so unrelated keys
 * such as `edit` survive pagination / canonicalization.
 */
export function mergeListSearchParams(
  current: URLSearchParams,
  written: URLSearchParams,
  ownedKeys: Iterable<string>,
) {
  const owned = new Set(ownedKeys)
  const nextParams = new URLSearchParams()

  for (const [key, value] of current.entries()) {
    if (!owned.has(key)) nextParams.append(key, value)
  }
  for (const [key, value] of written.entries()) {
    nextParams.append(key, value)
  }

  return nextParams
}

export function collectOwnedSearchParamKeys<TState>(
  read: (searchParams: URLSearchParams) => TState,
  searchParams: URLSearchParams,
  written: URLSearchParams,
) {
  const owned = new Set<string>(written.keys())
  read(trackSearchParamReads(searchParams, owned))
  return owned
}

export function searchParamsEqual(
  left: URLSearchParams,
  right: URLSearchParams,
) {
  if (left.toString() === right.toString()) return true

  const leftKeys = [...new Set(left.keys())].sort()
  const rightKeys = [...new Set(right.keys())].sort()
  if (leftKeys.length !== rightKeys.length) return false

  return leftKeys.every(
    (key, index) =>
      rightKeys[index] === key &&
      arraysEqual(left.getAll(key), right.getAll(key)),
  )
}

function trackSearchParamReads(
  searchParams: URLSearchParams,
  accessedKeys: Set<string>,
) {
  return new Proxy(searchParams, {
    get(target, property, receiver) {
      if (property === 'get' || property === 'getAll' || property === 'has') {
        return (name: string) => {
          accessedKeys.add(name)
          return (
            Reflect.get(target, property, receiver) as (name: string) => unknown
          ).call(target, name)
        }
      }

      const value = Reflect.get(target, property, receiver)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}

function arraysEqual(left: readonly string[], right: readonly string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  )
}

function shallowEqualRecord<TState extends object>(
  left: TState,
  right: TState,
) {
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)

  if (leftKeys.length !== rightKeys.length) return false

  return leftKeys.every((key) =>
    Object.is(left[key as keyof TState], right[key as keyof TState]),
  )
}
