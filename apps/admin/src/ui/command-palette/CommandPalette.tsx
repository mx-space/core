import './command-palette.css'

import type { LucideIcon } from 'lucide-react'
import { CornerDownLeft, Search } from 'lucide-react'
import { useRef } from 'react'

import { useI18n } from '~/i18n'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '~/ui/command'
import { Modal } from '~/ui/feedback/modal'

export interface CommandPaletteItem {
  id: string
  name: string
  subtitle?: string
  keywords?: string[]
  icon?: LucideIcon
  perform: () => void
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  items: ReadonlyArray<CommandPaletteItem>
}

export function CommandPalette({ open, onClose, items }: CommandPaletteProps) {
  const { t } = useI18n()
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <Modal
      className="w-[min(640px,calc(100vw-32px))]"
      initialFocus={inputRef}
      onClose={onClose}
      open={open}
      popupStyle={{ top: '15vh', translate: '-50% 0' }}
    >
      <Command className="flex flex-col" label={t('commandPalette.title')} loop>
        <div className="flex h-12 items-center gap-3 border-b border-border px-4">
          <Search
            aria-hidden="true"
            className="size-4 shrink-0 text-fg-subtle"
          />
          <CommandInput
            className="flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-fg-subtle"
            placeholder={t('commandPalette.placeholder')}
            ref={inputRef}
          />
          <kbd
            aria-hidden="true"
            className="inline-flex shrink-0 items-center justify-center rounded-sm bg-surface-inset px-1.5 py-0.5 font-mono text-xs text-fg-muted"
          >
            ESC
          </kbd>
        </div>
        <CommandList className="max-h-[50vh] overflow-y-auto px-1 py-1">
          <CommandEmpty className="flex flex-col items-center gap-3 px-6 py-10 text-sm text-fg-muted">
            <Search
              aria-hidden="true"
              className="size-8 text-fg-subtle"
              strokeWidth={1.5}
            />
            <span>{t('commandPalette.empty')}</span>
          </CommandEmpty>
          {items.map((item) => {
            const Icon = item.icon
            return (
              <CommandItem
                className="flex cursor-pointer items-center gap-3 rounded-sm px-3 py-2 text-sm text-fg outline-none data-[selected=true]:bg-accent-soft"
                key={item.id}
                keywords={item.keywords}
                onSelect={() => {
                  item.perform()
                  onClose()
                }}
                value={`${item.name} ${item.subtitle ?? ''}`}
              >
                {Icon ? (
                  <Icon
                    aria-hidden="true"
                    className="size-4 shrink-0 text-fg-muted"
                  />
                ) : (
                  <span aria-hidden className="inline-block size-4 shrink-0" />
                )}
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-fg">{item.name}</span>
                  {item.subtitle ? (
                    <span className="truncate text-xs text-fg-muted">
                      {item.subtitle}
                    </span>
                  ) : null}
                </div>
                <CornerDownLeft
                  aria-hidden="true"
                  className="size-3.5 shrink-0 text-fg-subtle opacity-0 transition-opacity"
                  data-cmd-palette-enter-hint
                />
              </CommandItem>
            )
          })}
        </CommandList>
      </Command>
    </Modal>
  )
}
