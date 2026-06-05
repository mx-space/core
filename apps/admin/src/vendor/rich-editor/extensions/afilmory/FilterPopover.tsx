import { SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'

import { Popover } from '~/ui/overlay/popover'
import { Button } from '~/ui/primitives/button'
import { cn } from '~/utils/cn'

import type { Facets, PhotoFilter } from './picker-helpers'
import {
  ChipButton,
  EMPTY_FILTER,
  FacetGroup,
  toggleArray,
} from './picker-helpers'

const SHOW_TOP_N = 12

interface FilterPopoverProps {
  activeCount: number
  facets: Facets
  filter: PhotoFilter
  setFilter: (next: PhotoFilter) => void
}

export function FilterPopover({
  activeCount,
  facets,
  filter,
  setFilter,
}: FilterPopoverProps) {
  const [open, setOpen] = useState(false)
  const hasAny = activeCount > 0

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <Popover.Trigger
        aria-label="Filters"
        className={cn(
          'inline-flex h-9 items-center gap-1.5 rounded-sm border px-3 text-sm transition-colors focus-visible:ring-[3px] focus-visible:ring-accent/15',
          open || hasAny
            ? 'border-border-strong bg-surface-inset text-fg'
            : 'border-border bg-surface-card text-fg-muted hover:bg-surface-inset hover:text-fg',
        )}
        type="button"
      >
        <SlidersHorizontal aria-hidden className="size-4" />
        <span>Filters</span>
        {hasAny ? (
          <span className="inline-flex size-4 items-center justify-center rounded-full bg-accent text-xs font-medium text-white">
            {activeCount}
          </span>
        ) : null}
      </Popover.Trigger>
      <Popover.Content
        align="end"
        className="w-[min(92vw,28rem)]"
        side="bottom"
        sideOffset={8}
      >
        <Popover.Header>
          <span>Filters</span>
          <button
            className="text-xs font-medium normal-case text-fg-muted hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!hasAny}
            onClick={() => setFilter(EMPTY_FILTER)}
            type="button"
          >
            Clear all
          </button>
        </Popover.Header>
        <div className="max-h-[60vh] overflow-auto">
          <Popover.Body className="space-y-4">
            <TagsSection
              facets={facets}
              filter={filter}
              setFilter={setFilter}
            />
            <FacetSection
              activeValues={filter.cameras}
              entries={facets.cameras}
              label="Cameras"
              onToggle={(value) =>
                setFilter({
                  ...filter,
                  cameras: toggleArray(filter.cameras, value),
                })
              }
              prefix="📷 "
            />
            <FacetSection
              activeValues={filter.lenses}
              entries={facets.lenses}
              label="Lenses"
              onToggle={(value) =>
                setFilter({
                  ...filter,
                  lenses: toggleArray(filter.lenses, value),
                })
              }
              prefix="🔭 "
            />
            <DateRangeSection filter={filter} setFilter={setFilter} />
          </Popover.Body>
        </div>
        <Popover.Footer>
          <span>
            {activeCount === 0 ? 'No filters' : `${activeCount} active`}
          </span>
          <Button
            className="h-7 px-2 text-xs"
            onClick={() => setOpen(false)}
            variant="secondary"
          >
            Done
          </Button>
        </Popover.Footer>
      </Popover.Content>
    </Popover>
  )
}

function TagsSection({
  facets,
  filter,
  setFilter,
}: {
  facets: Facets
  filter: PhotoFilter
  setFilter: (next: PhotoFilter) => void
}) {
  return (
    <FacetSection
      activeValues={filter.tags}
      entries={facets.tags}
      label="Tags"
      onToggle={(value) =>
        setFilter({ ...filter, tags: toggleArray(filter.tags, value) })
      }
      prefix="#"
      suffix={
        filter.tags.length > 1 ? (
          <TagModeSegmented
            mode={filter.tagMode}
            onChange={(tagMode) => setFilter({ ...filter, tagMode })}
          />
        ) : null
      }
    />
  )
}

interface FacetSectionProps {
  activeValues: string[]
  entries: Array<[string, number]>
  label: string
  onToggle: (value: string) => void
  prefix?: string
  suffix?: React.ReactNode
}

function FacetSection({
  activeValues,
  entries,
  label,
  onToggle,
  prefix = '',
  suffix,
}: FacetSectionProps) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? entries : entries.slice(0, SHOW_TOP_N)
  const hidden = entries.length - visible.length

  return (
    <FacetGroup
      label={
        <span className="flex items-center gap-1.5">
          <span>{label}</span>
          {activeValues.length > 0 ? (
            <span className="rounded-full bg-accent/15 px-1.5 text-xs text-accent">
              {activeValues.length}
            </span>
          ) : null}
        </span>
      }
      suffix={suffix}
    >
      {entries.length === 0 ? (
        <span className="text-xs text-fg-subtle">—</span>
      ) : (
        <>
          {visible.map(([value, count]) => (
            <ChipButton
              active={activeValues.includes(value)}
              count={count}
              key={value}
              label={`${prefix}${value}`}
              onClick={() => onToggle(value)}
            />
          ))}
          {hidden > 0 ? (
            <button
              className="text-xs text-fg-muted hover:text-fg"
              onClick={() => setExpanded(true)}
              type="button"
            >
              + show {hidden} more
            </button>
          ) : expanded && entries.length > SHOW_TOP_N ? (
            <button
              className="text-xs text-fg-muted hover:text-fg"
              onClick={() => setExpanded(false)}
              type="button"
            >
              show less
            </button>
          ) : null}
        </>
      )}
    </FacetGroup>
  )
}

function TagModeSegmented({
  mode,
  onChange,
}: {
  mode: PhotoFilter['tagMode']
  onChange: (m: PhotoFilter['tagMode']) => void
}) {
  return (
    <div className="inline-flex rounded-sm border border-border bg-surface-card p-0.5 text-xs">
      {(['union', 'intersection'] as const).map((m) => (
        <button
          className={cn(
            'rounded-xs px-2 py-0.5 transition-colors',
            mode === m ? 'bg-accent text-white' : 'text-fg-muted hover:text-fg',
          )}
          key={m}
          onClick={() => onChange(m)}
          type="button"
        >
          {m === 'union' ? 'any' : 'all'}
        </button>
      ))}
    </div>
  )
}

function DateRangeSection({
  filter,
  setFilter,
}: {
  filter: PhotoFilter
  setFilter: (next: PhotoFilter) => void
}) {
  return (
    <div className="grid gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wider text-fg-muted">
        Date
      </span>
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1">
          <span className="text-xs text-fg-muted">From</span>
          <input
            className="h-9 rounded-sm border border-border bg-surface-card px-2 text-sm text-fg focus:border-accent focus:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/15"
            onChange={(e) => setFilter({ ...filter, dateFrom: e.target.value })}
            type="date"
            value={filter.dateFrom}
          />
        </label>
        <label className="grid gap-1">
          <span className="text-xs text-fg-muted">To</span>
          <input
            className="h-9 rounded-sm border border-border bg-surface-card px-2 text-sm text-fg focus:border-accent focus:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/15"
            onChange={(e) => setFilter({ ...filter, dateTo: e.target.value })}
            type="date"
            value={filter.dateTo}
          />
        </label>
      </div>
    </div>
  )
}
