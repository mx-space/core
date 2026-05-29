import { Popover } from '@base-ui/react/popover'
import { ChevronDown, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { AgentSessionMeta } from '~/hooks/use-agent-session-manager'

import { useI18n } from '~/i18n'
import { confirmDialog } from '~/ui/feedback/confirm'
import { cn } from '~/utils/cn'

interface SessionHeaderProps {
  sessions: AgentSessionMeta[]
  activeSessionId: string | null
  isLoading: boolean
  loadError: boolean
  onSwitch: (id: string) => void
  onCreate: () => void
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
  onRetryLoad: () => void
}

export function SessionHeader(props: SessionHeaderProps) {
  const {
    sessions,
    activeSessionId,
    isLoading,
    loadError,
    onSwitch,
    onCreate,
    onDelete,
    onRename,
    onRetryLoad,
  } = props
  const { t } = useI18n()

  const activeSession = sessions.find((s) => s.id === activeSessionId)
  const activeTitle = activeSession?.title

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')

  useEffect(() => {
    setEditing(false)
    setValue(activeTitle ?? '')
  }, [activeSessionId, activeTitle])

  const relativeTime = (iso: string) => {
    const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
    if (minutes < 1) return t('write.agent.session.relativeJustNow')
    if (minutes < 60)
      return t('write.agent.session.relativeMinutes', { count: minutes })
    if (minutes < 1440)
      return t('write.agent.session.relativeHours', {
        count: Math.floor(minutes / 60),
      })
    return t('write.agent.session.relativeDays', {
      count: Math.floor(minutes / 1440),
    })
  }

  const finishEdit = () => {
    const trimmed = value.trim()
    if (trimmed && activeSessionId) onRename(activeSessionId, trimmed)
    setEditing(false)
  }

  const selectSession = (id: string) => {
    setOpen(false)
    if (id !== activeSessionId) onSwitch(id)
  }

  const handleDelete = async () => {
    if (!activeSessionId) return
    const ok = await confirmDialog({
      title: t('write.agent.session.deleteTitle'),
      destructive: true,
    })
    if (ok) onDelete(activeSessionId)
  }

  if (loadError) {
    return (
      <div className="flex h-9 shrink-0 items-center border-b border-neutral-200 px-2 dark:border-neutral-800">
        <button
          className="flex flex-1 items-center gap-1.5 text-left text-xs text-red-600"
          onClick={onRetryLoad}
          type="button"
        >
          <RefreshCw aria-hidden="true" className="size-3" />
          {t('write.agent.loadSessionsFailed')}
        </button>
      </div>
    )
  }

  const sorted = [...sessions].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )

  return (
    <div className="flex h-9 shrink-0 items-center gap-1 border-b border-neutral-200 px-2 dark:border-neutral-800">
      <div className="flex min-w-0 flex-1 items-center">
        {editing ? (
          <input
            autoFocus
            className="outline-hidden min-w-0 flex-1 border border-neutral-200 bg-transparent px-1.5 py-0.5 text-xs text-neutral-800 focus:border-[var(--color-primary)] dark:border-neutral-800 dark:text-neutral-200"
            onBlur={finishEdit}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                finishEdit()
              } else if (e.key === 'Escape') {
                setEditing(false)
              }
            }}
            value={value}
          />
        ) : (
          <Popover.Root onOpenChange={setOpen} open={open}>
            <Popover.Trigger
              className="flex min-w-0 items-center gap-1 text-sm font-medium text-neutral-800 dark:text-neutral-200"
              onDoubleClick={() => {
                setValue(activeTitle ?? '')
                setEditing(true)
              }}
              type="button"
            >
              <span className="truncate">
                {activeTitle || t('write.agent.session.untitled')}
              </span>
              <ChevronDown
                aria-hidden="true"
                className="size-3 shrink-0 opacity-50"
              />
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Positioner align="start" side="bottom" sideOffset={6}>
                <Popover.Popup className="outline-hidden max-h-64 w-64 overflow-y-auto border border-neutral-200 bg-white p-1 shadow-xl dark:border-neutral-800 dark:bg-neutral-950">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2
                        aria-hidden="true"
                        className="size-4 animate-spin text-neutral-400"
                      />
                    </div>
                  ) : sorted.length === 0 ? (
                    <div className="py-4 text-center text-xs text-neutral-400">
                      {t('write.agent.session.empty')}
                    </div>
                  ) : (
                    sorted.map((session) => (
                      <button
                        className={cn(
                          'flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/50',
                          session.id === activeSessionId &&
                            'bg-neutral-100 dark:bg-neutral-800',
                        )}
                        key={session.id}
                        onClick={() => selectSession(session.id)}
                        type="button"
                      >
                        <span className="truncate text-xs font-medium text-neutral-800 dark:text-neutral-200">
                          {session.title || t('write.agent.session.untitled')}
                        </span>
                        <span className="text-xs text-neutral-400">
                          {relativeTime(session.updatedAt)}
                          {' · '}
                          {t('write.agent.session.messageCount', {
                            count: session.messageCount,
                          })}
                        </span>
                      </button>
                    ))
                  )}
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
        )}
      </div>

      <div className="flex items-center gap-0.5">
        <button
          className="flex size-7 items-center justify-center text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          onClick={onCreate}
          title={t('write.agent.session.newTitle')}
          type="button"
        >
          <Plus aria-hidden="true" className="size-3.5" />
        </button>
        {activeSessionId ? (
          <button
            className="flex size-7 items-center justify-center text-neutral-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-500"
            onClick={handleDelete}
            title={t('write.agent.session.deleteTitle')}
            type="button"
          >
            <Trash2 aria-hidden="true" className="size-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  )
}
