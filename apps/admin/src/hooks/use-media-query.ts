import { useEffect, useState } from 'react'

export const DESKTOP_MEDIA_QUERY = '(min-width: 1024px)'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    // SSR fallback: assume desktop so admin server renders the desktop layout
    if (typeof window === 'undefined') return true
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const list = window.matchMedia(query)
    const update = () => setMatches(list.matches)
    list.addEventListener('change', update)
    return () => list.removeEventListener('change', update)
  }, [query])

  return matches
}
