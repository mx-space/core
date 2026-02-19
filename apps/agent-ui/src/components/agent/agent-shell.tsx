import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useAgentStore } from '@/lib/agent-store'
import { PanelLeft, PenSquare, Settings2 } from 'lucide-react'
import { ChatMessages } from './chat-messages'
import { InputBar } from './input-bar'
import { SettingsPanel } from './settings-panel'
import { Sidebar } from './sidebar'

export function AgentShell() {
  const store = useAgentStore()

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <Sidebar />

      {/* Main area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top bar */}
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            {!store.sidebarOpen && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-foreground"
                    onClick={() => store.setSidebarOpen(true)}
                    aria-label="Open sidebar"
                  >
                    <PanelLeft className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Open sidebar</TooltipContent>
              </Tooltip>
            )}
            <div className="flex items-center gap-3">
              <div className="flex size-7 items-center justify-center">
                <svg
                  className="size-5 text-foreground"
                  viewBox="0 0 76 65"
                  fill="currentColor"
                >
                  <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
                </svg>
              </div>
              <div className="h-4 w-px bg-border" />
              <h1 className="text-sm font-medium text-foreground">MX Agent</h1>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-foreground"
                  onClick={store.newSession}
                  aria-label="New chat"
                >
                  <PenSquare className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>New chat</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-foreground"
                  onClick={() => store.setSettingsOpen(true)}
                  aria-label="Settings"
                >
                  <Settings2 className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Settings</TooltipContent>
            </Tooltip>
          </div>
        </header>

        {/* Chat area */}
        <ChatMessages />

        {/* Input area */}
        <InputBar />

        {/* Settings dialog */}
        <SettingsPanel />
      </div>
    </div>
  )
}
