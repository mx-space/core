import { ChevronDown, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import type { AgentSessionMeta } from '~/hooks/use-agent-session-manager'
import { useI18n } from '~/i18n'
import { confirmDialog } from '~/ui/feedback/confirm'
import { DropdownMenu } from '~/ui/overlay/dropdown-menu'
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

function formatSessionLabel(id: string) {
  return id.length > 10 ? `${id.slice(0, 8)}…` : id
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
  const activeTitle = activeSession ? formatSessionLabel(activeSession.id) : ''

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
          <DropdownMenu onOpenChange={setOpen} open={open}>
            <DropdownMenu.Trigger
              className="flex min-w-0 items-center gap-1 text-sm font-medium text-fg"
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
            </DropdownMenu.Trigger>
            <DropdownMenu.Content className="max-h-64 w-64 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2
                    aria-hidden="true"
                    className="size-4 animate-spin text-fg-subtle"
                  />
                </div>
              ) : sorted.length === 0 ? (
                <DropdownMenu.Empty>
                  {t('write.agent.session.empty')}
                </DropdownMenu.Empty>
              ) : (
                sorted.map((session) => (
                  <DropdownMenu.Item
                    aria-current={
                      session.id === activeSessionId ? 'true' : undefined
                    }
                    className={cn(
                      'flex-col items-start gap-0.5',
                      session.id === activeSessionId && 'bg-surface-inset',
                    )}
                    key={session.id}
                    onClick={() => selectSession(session.id)}
                  >
                    <span className="w-full truncate text-xs font-medium text-fg">
                      {formatSessionLabel(session.id)}
                    </span>
                    <span className="w-full truncate text-xs text-fg-subtle">
                      {relativeTime(session.updatedAt)}
                    </span>
                  </DropdownMenu.Item>
                ))
              )}
            </DropdownMenu.Content>
          </DropdownMenu>
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
