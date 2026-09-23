import type { MapTrackLeg } from '@mx-space/editor'
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react'

import { Button } from '~/ui/primitives/button'
import { TextInput } from '~/ui/primitives/text-field'

export interface MapLegDraft {
  id: string
  title: string
}

interface MapLegListProps {
  adding: boolean
  legs: MapLegDraft[]
  meta: MapTrackLeg[] | undefined
  onAdd: () => void
  onMove: (index: number, delta: -1 | 1) => void
  onRemove: (index: number) => void
  onRename: (index: number, title: string) => void
}

const dateFormat = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
})

export function MapLegList({
  adding,
  legs,
  meta,
  onAdd,
  onMove,
  onRemove,
  onRename,
}: MapLegListProps) {
  return (
    <div className="grid gap-2">
      {legs.length > 1 ? (
        <LegRows {...{ legs, meta, onMove, onRemove, onRename }} />
      ) : null}
      <div>
        <Button
          disabled={adding}
          onClick={onAdd}
          type="button"
          variant="secondary"
        >
          <Plus aria-hidden="true" className="size-4" />
          Add another GPX
        </Button>
      </div>
    </div>
  )
}

function LegRows({
  legs,
  meta,
  onMove,
  onRemove,
  onRename,
}: Omit<MapLegListProps, 'adding' | 'onAdd'>) {
  return (
    <ol className="grid gap-2">
      {legs.map((leg, index) => {
        const info = meta?.[index]
        const details = [
          info?.startTimeMs ? dateFormat.format(info.startTimeMs) : null,
          typeof info?.distanceMeters === 'number'
            ? `${(info.distanceMeters / 1000).toFixed(1)} km`
            : null,
        ].filter(Boolean)
        return (
          <li className="flex items-center gap-2" key={leg.id}>
            <span className="w-4 shrink-0 text-right text-xs text-fg-subtle tabular-nums">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <TextInput
                aria-label={`Leg ${index + 1} title`}
                onChange={(value) => onRename(index, value)}
                value={leg.title}
              />
            </div>
            <span className="w-28 shrink-0 truncate text-xs text-fg-muted tabular-nums">
              {details.join(' · ')}
            </span>
            <Button
              aria-label="Move leg up"
              className="h-8 w-8"
              disabled={index === 0}
              iconOnly
              onClick={() => onMove(index, -1)}
              type="button"
              variant="ghost"
            >
              <ArrowUp aria-hidden="true" className="size-4" />
            </Button>
            <Button
              aria-label="Move leg down"
              className="h-8 w-8"
              disabled={index === legs.length - 1}
              iconOnly
              onClick={() => onMove(index, 1)}
              type="button"
              variant="ghost"
            >
              <ArrowDown aria-hidden="true" className="size-4" />
            </Button>
            <Button
              aria-label="Remove leg"
              className="h-8 w-8"
              iconOnly
              onClick={() => onRemove(index)}
              type="button"
              variant="ghost"
            >
              <X aria-hidden="true" className="size-4" />
            </Button>
          </li>
        )
      })}
    </ol>
  )
}
