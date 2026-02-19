import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useAgentStore } from '@/lib/agent-store'
import { cn } from '@/lib/utils'
import { Loader2, MessageSquare, PenSquare, X } from 'lucide-react'

function formatRelativeDate(iso: string) {
  const ts = new Date(iso).getTime()
  const now = Date.now()
  const diff = now - ts
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export function Sidebar() {
  const store = useAgentStore()
  const sessions = Array.isArray(store.sessions) ? store.sessions : []

  const groupedSessions = (() => {
    const now = Date.now()
    const today: typeof sessions = []
    const week: typeof sessions = []
    const older: typeof sessions = []

    for (const s of sessions) {
      const diff = now - new Date(s.updated).getTime()
      if (diff < 86400000) today.push(s)
      else if (diff < 604800000) week.push(s)
      else older.push(s)
    }
    return [
      { label: 'Today', items: today },
      { label: 'This Week', items: week },
      { label: 'Older', items: older },
    ].filter((g) => g.items.length > 0)
  })()

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-border bg-card transition-all duration-200 overflow-hidden',
        store.sidebarOpen ? 'w-64' : 'w-0 border-r-0',
      )}
    >
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Chats
        </span>
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground"
                onClick={store.newSession}
                aria-label="New chat"
              >
                <PenSquare className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">New chat</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground"
                onClick={() => store.setSidebarOpen(false)}
                aria-label="Close sidebar"
              >
                <X className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Close sidebar</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {store.loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}

        {!store.loading &&
          groupedSessions.map((group) => (
            <div key={group.label} className="mb-3">
              <p className="mb-1 px-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">
                {group.label}
              </p>
              <div className="flex flex-col gap-0.5">
                {group.items.map((session) => (
                  <div
                    key={session.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => store.switchSession(session.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        store.switchSession(session.id)
                      }
                    }}
                    className={cn(
                      'group flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors',
                      session.id === store.activeSessionId
                        ? 'bg-secondary text-foreground'
                        : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
                    )}
                  >
                    <MessageSquare className="size-3.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm leading-tight">
                        {session.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                        {formatRelativeDate(session.updated)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

        {!store.loading && sessions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <MessageSquare className="size-8 text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground/50">
              No conversations yet
            </p>
          </div>
        )}
      </nav>
    </aside>
  )
}
