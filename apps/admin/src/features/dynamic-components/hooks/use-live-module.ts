import { useEffect, useRef, useState } from 'react'

import { checkComponentModule } from '../utils/component-source'

const REBUILD_DELAY_MS = 600

interface LiveModule {
  error: string | null
  url: string | null
}

export function useLiveModule(
  source: string | null,
  previewProps: Record<string, unknown>,
): LiveModule {
  const [state, setState] = useState<LiveModule>({ error: null, url: null })
  const workingUrlRef = useRef<string | null>(null)
  const previewPropsRef = useRef(previewProps)

  useEffect(() => {
    previewPropsRef.current = previewProps
  }, [previewProps])

  useEffect(() => {
    if (source === null) return
    let cancelled = false
    const timer = setTimeout(async () => {
      const url = URL.createObjectURL(
        new Blob([source], { type: 'text/javascript' }),
      )
      const error = await checkComponentModule(
        url,
        undefined,
        previewPropsRef.current,
      )
      if (cancelled || error) {
        URL.revokeObjectURL(url)
        if (!cancelled) setState((previous) => ({ ...previous, error }))
        return
      }
      if (workingUrlRef.current) URL.revokeObjectURL(workingUrlRef.current)
      workingUrlRef.current = url
      setState({ error: null, url })
    }, REBUILD_DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [source])

  useEffect(
    () => () => {
      if (workingUrlRef.current) URL.revokeObjectURL(workingUrlRef.current)
    },
    [],
  )

  return state
}
