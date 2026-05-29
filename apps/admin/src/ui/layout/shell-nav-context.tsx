import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'

interface ShellNavValue {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
  hasOwnHeader: boolean
  registerPageHeader: () => () => void
}

const ShellNavContext = createContext<ShellNavValue | null>(null)

export function ShellNavProvider(props: {
  children: ReactNode
  open: boolean
  setOpen: (open: boolean) => void
}) {
  const pageHeaderCountRef = useRef(0)
  const [hasOwnHeader, setHasOwnHeader] = useState(false)

  const registerPageHeader = useCallback(() => {
    pageHeaderCountRef.current += 1
    if (pageHeaderCountRef.current === 1) {
      setHasOwnHeader(true)
    }
    return () => {
      pageHeaderCountRef.current -= 1
      if (pageHeaderCountRef.current === 0) {
        setHasOwnHeader(false)
      }
    }
  }, [])

  const value = useMemo<ShellNavValue>(
    () => ({
      open: props.open,
      setOpen: props.setOpen,
      toggle: () => props.setOpen(!props.open),
      hasOwnHeader,
      registerPageHeader,
    }),
    [props.open, props.setOpen, hasOwnHeader, registerPageHeader],
  )

  return (
    <ShellNavContext.Provider value={value}>
      {props.children}
    </ShellNavContext.Provider>
  )
}

export function useShellNav(): ShellNavValue | null {
  return useContext(ShellNavContext)
}
