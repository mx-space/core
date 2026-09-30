import { useMemo, useState } from 'react'
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
  // Tracking the loaded src instead of resetting a flag in an effect: a cached
  // image can fire `load` before the effect runs, which left it at opacity 0.
  const [loadedSrc, setLoadedSrc] = useState<null | string>(null)
  const loaded = loadedSrc === props.src
  const placeholder = useMemo(
    () => (props.thumbhash ? decodeThumbhashToDataUrl(props.thumbhash) : null),
    [props.thumbhash],
  )
  const backgroundColor = isPreviewColor(props.dominantColor)
    ? props.dominantColor
    : undefined

  return (
    <span
      className="relative block h-full w-full overflow-hidden bg-surface-inset"
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
            'absolute inset-0 bg-surface-inset transition-opacity duration-300',
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
        onError={() => setLoadedSrc(props.src)}
        onLoad={() => setLoadedSrc(props.src)}
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
