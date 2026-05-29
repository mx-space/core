import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'

import { cn } from '~/utils/cn'

interface BorderlessSearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  ariaLabel: string
  className?: string
  debounceMs?: number
}

export function BorderlessSearchInput(props: BorderlessSearchInputProps) {
  const debounceMs = props.debounceMs ?? 300
  const [local, setLocal] = useState(props.value)

  useEffect(() => {
    setLocal(props.value)
  }, [props.value])

  useEffect(() => {
    if (local === props.value) return
    const timer = window.setTimeout(() => {
      props.onChange(local)
    }, debounceMs)
    return () => window.clearTimeout(timer)
  }, [local, debounceMs])

  return (
    <label
      className={cn(
        'relative flex h-full w-full items-center',
        props.className,
      )}
    >
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 size-4 text-neutral-400"
      />
      <input
        aria-label={props.ariaLabel}
        className="outline-hidden h-full w-full bg-transparent pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 dark:text-neutral-100"
        onChange={(event) => setLocal(event.target.value)}
        placeholder={props.placeholder}
        type="search"
        value={local}
      />
    </label>
  )
}
