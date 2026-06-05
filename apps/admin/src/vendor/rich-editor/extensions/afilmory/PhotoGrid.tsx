import { Check } from 'lucide-react'

import { cn } from '~/utils/cn'

import { formatDateShort } from './picker-helpers'
import type { AfilmoryManifestPhoto } from './types'

interface PhotoGridProps {
  onToggle: (id: string) => void
  photos: AfilmoryManifestPhoto[]
  selectedSet: Set<string>
}

export function PhotoGrid({ onToggle, photos, selectedSet }: PhotoGridProps) {
  return (
    <div className="grid grid-cols-2 gap-2 p-4 tablet:grid-cols-3 desktop:grid-cols-5">
      {photos.map((photo) => (
        <PhotoGridCell
          key={photo.id}
          onToggle={() => onToggle(photo.id)}
          photo={photo}
          selected={selectedSet.has(photo.id)}
        />
      ))}
    </div>
  )
}

function PhotoGridCell({
  onToggle,
  photo,
  selected,
}: {
  onToggle: () => void
  photo: AfilmoryManifestPhoto
  selected: boolean
}) {
  const date = formatDateShort(photo.dateTaken ?? photo.exif?.DateTimeOriginal)
  const label = photo.title || photo.id

  return (
    <button
      aria-label={label}
      aria-pressed={selected}
      className={cn(
        'group relative block aspect-square w-full overflow-hidden rounded-md border bg-surface-inset transition focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-accent/15',
        selected
          ? 'border-accent ring-2 ring-accent/40'
          : 'border-border hover:border-border-strong',
      )}
      onClick={onToggle}
      title={photo.id + (date ? ` · ${date}` : '')}
      type="button"
    >
      <img
        alt={label}
        className="absolute inset-0 size-full object-cover"
        decoding="async"
        draggable={false}
        loading="lazy"
        src={photo.thumbnailUrl}
      />
      {selected ? (
        <span className="pointer-events-none absolute inset-0 bg-accent/20" />
      ) : null}
      <span
        className={cn(
          'pointer-events-none absolute right-1.5 top-1.5 inline-flex size-5 items-center justify-center rounded-full text-white transition',
          selected
            ? 'bg-accent opacity-100'
            : 'bg-black/45 opacity-0 group-hover:opacity-100',
        )}
      >
        <Check aria-hidden className="size-3" strokeWidth={3} />
      </span>
      <span
        className={cn(
          'pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/75 via-black/40 to-transparent px-2 pb-1.5 pt-6 text-xs text-white opacity-0 transition-opacity',
          'group-hover:opacity-100 group-focus-visible:opacity-100',
        )}
      >
        <span className="min-w-0 truncate font-mono">{photo.id}</span>
        {date ? <span className="shrink-0 font-mono">{date}</span> : null}
      </span>
    </button>
  )
}
