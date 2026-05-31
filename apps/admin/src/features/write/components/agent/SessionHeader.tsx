import {
  ChevronDown,
  Download,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'

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
  onExport: () => void
}

function parseDate(value: string | undefined | null): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function pickSessionDate(session: AgentSessionMeta): Date | null {
  return parseDate(session.createdAt) ?? parseDate(session.updatedAt)
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
    onRetryLoad,
    onExport,
  } = props
  const { t } = useI18n()

  const activeSession = sessions.find((s) => s.id === activeSessionId)
  const [open, setOpen] = useState(false)

  const relativeTime = (date: Date | null) => {
    if (!date) return t('write.agent.session.untitled')
    const minutes = Math.floor((Date.now() - date.getTime()) / 60000)
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

  const sessionLabel = (session: AgentSessionMeta) =>
    session.title ??
    session.derivedTitle ??
    relativeTime(pickSessionDate(session))

  const activeTitle = activeSession
    ? sessionLabel(activeSession)
    : t('write.agent.session.untitled')

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
      <div className="flex h-9 shrink-0 items-center border-b border-border px-2">
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

  const sorted = [...sessions].sort((a, b) => {
    const da = pickSessionDate(a)?.getTime() ?? 0
    const db = pickSessionDate(b)?.getTime() ?? 0
    return db - da
  })

  return (
    <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border px-2">
      <div className="flex min-w-0 flex-1 items-center">
        <DropdownMenu onOpenChange={setOpen} open={open}>
          <DropdownMenu.Trigger
            className="flex min-w-0 items-center gap-1 text-sm font-medium text-fg"
            type="button"
          >
            <span className="truncate">{activeTitle}</span>
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
              sorted.map((session) => {
                const subDate =
                  parseDate(session.updatedAt) ?? parseDate(session.createdAt)
                const hasTopTitle = Boolean(
                  session.title ?? session.derivedTitle,
                )
                const sub = hasTopTitle ? relativeTime(subDate) : null
                return (
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
                      {sessionLabel(session)}
                    </span>
                    {sub ? (
                      <span className="w-full truncate text-xs text-fg-subtle">
                        {sub}
                      </span>
                    ) : null}
                  </DropdownMenu.Item>
                )
              })
            )}
          </DropdownMenu.Content>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-0.5">
        <button
          className="flex size-7 items-center justify-center rounded-sm text-fg-muted transition-colors hover:bg-surface-inset hover:text-fg"
          onClick={onExport}
          title={t('write.agent.session.export')}
          type="button"
        >
          <Download aria-hidden="true" className="size-3.5" />
        </button>
        <button
          className="flex size-7 items-center justify-center rounded-sm text-fg-muted transition-colors hover:bg-surface-inset hover:text-fg"
          onClick={onCreate}
          title={t('write.agent.session.newTitle')}
          type="button"
        >
          <Plus aria-hidden="true" className="size-3.5" />
        </button>
        {activeSessionId ? (
          <button
            className="flex size-7 items-center justify-center rounded-sm text-fg-muted transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-500"
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
