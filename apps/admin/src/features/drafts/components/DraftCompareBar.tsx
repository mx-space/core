import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Loader2,
  RotateCcw,
} from 'lucide-react'
import { useRef, useState } from 'react'

import { useI18n } from '~/i18n'
import { FocusScope, setActiveScope, useScopeArrowNav } from '~/ui/focus-scope'
import { Popover } from '~/ui/overlay/popover'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { SegmentedControl } from '~/ui/primitives/segmented-control'
import { relativeTimeFromNow } from '~/utils/time'

import type { DraftDiffStats, VersionItem } from '../types/drafts'
import { VersionRow } from './VersionRow'

export type DraftCompareView = 'changes' | 'full'

export function DraftCompareBar(props: {
  diffStats: DraftDiffStats | null
  doomed: Set<string>
  items: VersionItem[]
  onOpenSplit: () => void
  onRestore: (id: string) => void
  onSelect: (id: string) => void
  onViewChange: (view: DraftCompareView) => void
  restorePendingId: string | null
  scopeId: string
  selectedId: string | null
  view: DraftCompareView
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const listRef = useRef<HTMLDivElement | null>(null)
  const history = props.items.filter((item) => !item.isCurrent)
  const index = history.findIndex((item) => item.id === props.selectedId)
  const selected = index === -1 ? null : history[index]

  useScopeArrowNav({
    itemSelector: '[data-scope-item="row"]',
    onItemFocus: (element) => {
      const id = element.getAttribute('data-id')
      if (id) props.onSelect(id)
    },
    scopeId: props.scopeId,
  })

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-surface-inset px-6 py-2.5">
      <span className="text-sm text-fg-muted">{t('drafts.compare.label')}</span>
      <Button
        aria-label={t('drafts.compare.prevAria')}
        className="size-8 px-0"
        disabled={index === -1 || index >= history.length - 1}
        onClick={() => props.onSelect(history[index + 1].id)}
        type="button"
        variant="subtle"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
      </Button>
      <Popover
        onOpenChange={(next) => {
          setOpen(next)
          if (next) setActiveScope(props.scopeId)
        }}
        open={open}
      >
        <Popover.Trigger
          aria-label={t('drafts.compare.pickerAria')}
          className="flex h-8 min-w-56 max-w-80 items-center justify-between gap-2 rounded-sm border border-border bg-surface-card pl-3 pr-2 text-left text-sm text-fg transition-colors hover:bg-surface-inset"
        >
          <span className="truncate">
            {selected
              ? `${relativeTimeFromNow(selected.savedAt)} · ${selected.title || t('drafts.row.untitled')}`
              : t('drafts.history.pickVersion')}
          </span>
          <ChevronDown
            aria-hidden="true"
            className="size-4 shrink-0 text-fg-subtle"
          />
        </Popover.Trigger>
        <Popover.Content
          className="flex max-h-[min(28rem,var(--available-height))] flex-col overflow-hidden"
          initialFocus={() =>
            listRef.current?.querySelector<HTMLElement>(
              `[data-scope-item="row"][data-id="${props.selectedId}"]`,
            ) ??
            listRef.current?.querySelector<HTMLElement>(
              '[data-scope-item="row"]',
            ) ??
            true
          }
          width="xl"
        >
          <Popover.Header>
            <span>
              {t('drafts.compare.versionCount', { count: history.length })}
            </span>
            <span className="normal-case tracking-normal">
              {t('drafts.compare.doomedHint')}
            </span>
          </Popover.Header>
          <FocusScope
            className="outline-hidden min-h-0 flex-1"
            id={props.scopeId}
          >
            <Scroll className="max-h-96">
              <div ref={listRef}>
                {history.map((item) => (
                  <div
                    className={
                      props.doomed.has(item.id) ? 'opacity-60' : undefined
                    }
                    key={item.id}
                  >
                    <VersionRow
                      diffStats={
                        item.id === props.selectedId ? props.diffStats : null
                      }
                      doomed={props.doomed.has(item.id)}
                      item={item}
                      onRestore={() => props.onRestore(item.id)}
                      onSelect={() => {
                        props.onSelect(item.id)
                        setOpen(false)
                      }}
                      restorePending={props.restorePendingId === item.id}
                      selected={item.id === props.selectedId}
                    />
                  </div>
                ))}
              </div>
            </Scroll>
          </FocusScope>
        </Popover.Content>
      </Popover>
      <Button
        aria-label={t('drafts.compare.nextAria')}
        className="size-8 px-0"
        disabled={index <= 0}
        onClick={() => props.onSelect(history[index - 1].id)}
        type="button"
        variant="subtle"
      >
        <ChevronRight aria-hidden="true" className="size-4" />
      </Button>
      <span className="text-sm text-fg-muted">
        → {t('drafts.history.current')}
      </span>
      {props.diffStats && !props.diffStats.isSame ? (
        <span className="text-xs tabular-nums text-fg-muted">
          {t('drafts.history.deltaChars', {
            delta:
              props.diffStats.delta > 0
                ? `+${props.diffStats.delta}`
                : props.diffStats.delta,
          })}
        </span>
      ) : null}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <SegmentedControl<DraftCompareView>
          aria-label={t('drafts.compare.viewAria')}
          onValueChange={props.onViewChange}
          options={[
            { label: t('drafts.compare.changesOnly'), value: 'changes' },
            { label: t('drafts.compare.fullText'), value: 'full' },
          ]}
          value={props.view}
        />
        <Button
          className="h-8 px-2.5"
          disabled={!selected}
          onClick={props.onOpenSplit}
          type="button"
          variant="subtle"
        >
          <Columns2 aria-hidden="true" className="size-4" />
          {t('drafts.compare.openSplit')}
        </Button>
        <Button
          className="h-8 px-2.5"
          disabled={!selected || props.restorePendingId === selected.id}
          onClick={() => selected && props.onRestore(selected.id)}
          type="button"
          variant="subtle"
        >
          {selected && props.restorePendingId === selected.id ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <RotateCcw aria-hidden="true" className="size-4" />
          )}
          {t('drafts.compare.restore')}
        </Button>
      </div>
    </div>
  )
}
