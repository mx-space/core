import { useEffect, useMemo, useState } from 'react'
import { thumbHashToDataURL } from 'thumbhash'

import { cn } from '~/utils/cn'

import { isPreviewColor } from '../utils/format'

interface FileThumbnailProps {
  src: string
  alt: string
  thumbhash?: null | string
  dominantColor?: string
  className?: string
}

export function FileThumbnail(props: FileThumbnailProps) {
  const [loaded, setLoaded] = useState(false)
  const placeholder = useMemo(
    () => (props.thumbhash ? decodeThumbhashToDataUrl(props.thumbhash) : null),
    [props.thumbhash],
  )
  const backgroundColor = isPreviewColor(props.dominantColor)
    ? props.dominantColor
    : undefined

  useEffect(() => {
    setLoaded(false)
  }, [props.src])

  return (
    <span
      className="relative block h-full w-full overflow-hidden bg-neutral-100 dark:bg-neutral-900"
      style={backgroundColor ? { backgroundColor } : undefined}
    >
      {placeholder ? (
        <img
          alt=""
          aria-hidden="true"
          className={cn(
            'absolute inset-0 h-full w-full scale-110 object-cover blur-md transition-opacity duration-300',
            loaded ? 'opacity-0' : 'opacity-100',
          )}
          decoding="async"
          src={placeholder}
        />
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            'absolute inset-0 bg-neutral-100 transition-opacity duration-300 dark:bg-neutral-900',
            loaded ? 'opacity-0' : 'opacity-100',
          )}
        />
      )}
      <img
        alt={props.alt}
        className={cn(
          'relative z-[1] transition-opacity duration-300',
          props.className,
          loaded ? 'opacity-100' : 'opacity-0',
        )}
        decoding="async"
        loading="lazy"
        onError={() => setLoaded(true)}
        onLoad={() => setLoaded(true)}
        src={props.src}
      />
    </span>
  )
}

function decodeThumbhashToDataUrl(hash: string): null | string {
  try {
    if (typeof window === 'undefined') return null
    const bin = atob(hash)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return thumbHashToDataURL(bytes)
  } catch {
    return null
  }
}
