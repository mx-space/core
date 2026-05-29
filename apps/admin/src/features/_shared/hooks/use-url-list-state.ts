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
    const nextParams = options.write(state)
    if (nextParams.toString() !== searchParamsKey) {
      setSearchParams(nextParams, { replace: true })
    }
  }, [options, searchParamsKey, setSearchParams, state])

  const updateState = useCallback((updater: StateUpdater<TState>) => {
    setState((current) => {
      if (typeof updater === 'function') return updater(current)
      return { ...current, ...updater }
    })
  }, [])

  return [state, updateState] as const
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
