import { useState } from 'react'

export function useLocalStorageState<T>(key: string, initialValue: T) {
  const [state, setState] = useState<T>(() => {
    const rawValue = window.localStorage.getItem(key)

    if (!rawValue) return initialValue

    try {
      return JSON.parse(rawValue) as T
    } catch {
      return rawValue as T
    }
  })

  const setStoredState = (nextState: T) => {
    setState(nextState)
    window.localStorage.setItem(key, JSON.stringify(nextState))
  }

  return [state, setStoredState] as const
}
