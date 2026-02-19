import { useAgentStore } from '@/lib/agent-store'
import { cn } from '@/lib/utils'
import type { AIAgentMessage, WsConfirmRequest } from '@/types/agent'
import { AIAgentMessageKind } from '@/types/agent'
import {
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Loader2,
  User,
  Wrench,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { extractTextFromContent, MarkdownStream } from './markdown-stream'
import { ToolCallCard } from './tool-call-card'
import { ToolConfirmCard } from './tool-confirm-card'
import { ToolResultCard } from './tool-result-card'

function formatTime(isoOrTimestamp: string | number) {
  const date =
    typeof isoOrTimestamp === 'string'
      ? new Date(isoOrTimestamp)
      : new Date(isoOrTimestamp)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function ThinkingBlock({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="my-2 overflow-hidden rounded-lg border border-border/50 bg-muted/30 transition-colors hover:bg-muted/50">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider"
      >
        <Brain className="size-3" />
        <span>Thinking Process</span>
        <div className="ml-auto">
          {expanded ? (
            <ChevronDown className="size-3" />
          ) : (
            <ChevronRight className="size-3" />
          )}
        </div>
      </button>
      {expanded && (
        <div className="border-t border-border/50 bg-background/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground italic">
          <div className="whitespace-pre-wrap">{content}</div>
        </div>
      )}
    </div>
  )
}

function ToolCallItem({ name, args }: { name: string; args: any }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="my-1 overflow-hidden rounded-lg border border-border bg-card/50">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left"
      >
        <Wrench className="size-3 text-muted-foreground shrink-0" />
        <span className="text-[10px] font-medium text-foreground truncate">
          Call: {name}
        </span>
        <div className="ml-auto">
          {expanded ? (
            <ChevronDown className="size-3" />
          ) : (
            <ChevronRight className="size-3" />
          )}
        </div>
      </button>
      {expanded && (
        <div className="border-t border-border px-3 py-2">
          <pre className="text-[10px] text-foreground bg-secondary/50 rounded p-1.5 overflow-x-auto font-mono">
            {JSON.stringify(args, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

function MessageBubble({ message }: { message: AIAgentMessage }) {
  const [copied, setCopied] = useState(false)
  const { pendingActions } = useAgentStore()
  const isUser = message.kind === AIAgentMessageKind.User
  const isAssistant = message.kind === AIAgentMessageKind.Assistant
  const textContent = extractTextFromContent(message.content)

  const handleCopy = () => {
    navigator.clipboard.writeText(textContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (message.kind === AIAgentMessageKind.ConfirmRequest) {
    const data = message.content as WsConfirmRequest | null
    if (!data) return null

    const isPending = pendingActions.some((a) => a.actionId === data.actionId)

    return <ToolConfirmCard request={data} isPending={isPending} />
  }

  if (message.kind === AIAgentMessageKind.ConfirmResult) {
    const data = (message.content as any)?.message || message.content
    const actionState = data?.state as string
    return (
      <div className="py-2">
        <div
          className={cn(
            'rounded-lg border px-3 py-2 text-xs',
            actionState === 'confirmed' || actionState === 'executed'
              ? 'border-success/30 bg-success/5 text-success'
              : 'border-muted-foreground/30 bg-muted text-muted-foreground',
          )}
        >
          Action {actionState}: {(data?.toolName as string) || 'unknown'}
        </div>
      </div>
    )
  }

  if (message.kind === AIAgentMessageKind.ToolResult) {
    return <ToolResultCard message={message} />
  }

  // Handle structured assistant message content
  const structuredContent = (message.content as any)?.message?.content as
    | any[]
    | undefined

  return (
    <div
      className={cn(
        'group flex gap-3 py-4',
        isUser ? 'justify-end' : 'justify-start',
      )}
    >
      {!isUser && (
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary border border-border">
          <div className="size-3.5 rounded-full bg-foreground" />
        </div>
      )}

      <div className={cn('max-w-[80%] min-w-0', isUser ? 'order-first' : '')}>
        <div
          className={cn(
            'mb-1 flex items-center gap-2',
            isUser ? 'justify-end' : '',
          )}
        >
          <span className="text-[10px] text-muted-foreground/50">
            {formatTime(message.created)}
          </span>
        </div>

        <div
          className={cn(
            'rounded-xl px-4 py-2.5 text-sm leading-relaxed',
            isUser
              ? 'bg-foreground text-background rounded-br-sm shadow-sm'
              : 'bg-card border border-border rounded-bl-sm shadow-sm',
          )}
        >
          {structuredContent ? (
            <div className="space-y-1">
              {structuredContent.map((item, i) => {
                if (item.type === 'thinking') {
                  return <ThinkingBlock key={i} content={item.thinking} />
                }
                if (item.type === 'text') {
                  return <MarkdownStream key={i} content={item.text} />
                }
                if (item.type === 'toolCall') {
                  return (
                    <ToolCallItem
                      key={i}
                      name={item.name}
                      args={item.arguments}
                    />
                  )
                }
                return null
              })}
            </div>
          ) : isAssistant ? (
            <MarkdownStream content={textContent} />
          ) : (
            <div className="whitespace-pre-wrap">{textContent}</div>
          )}
        </div>

        {isAssistant && (
          <div className="mt-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={handleCopy}
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              aria-label="Copy message"
            >
              {copied ? (
                <Check className="size-3" />
              ) : (
                <Copy className="size-3" />
              )}
            </button>
          </div>
        )}
      </div>

      {isUser && (
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-foreground shadow-sm">
          <User className="size-3.5 text-background" />
        </div>
      )}
    </div>
  )
}

function StreamingMessage({ delta }: { delta: string }) {
  return (
    <div className="group flex gap-3 py-4 justify-start">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary border border-border">
        <div className="size-3.5 rounded-full bg-foreground" />
      </div>
      <div className="max-w-[80%] min-w-0">
        <div className="rounded-xl px-4 py-2.5 text-sm leading-relaxed bg-card border border-border rounded-bl-sm">
          <MarkdownStream content={delta} streaming />
        </div>
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 py-2 px-1 text-muted-foreground">
      <Loader2 className="size-3.5 animate-spin" />
      <span className="text-xs">Agent is working...</span>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-20">
      <div className="flex size-12 items-center justify-center rounded-xl bg-secondary border border-border mb-4">
        <svg
          className="size-6 text-muted-foreground"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          <path d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
        </svg>
      </div>
      <h2 className="text-lg font-medium text-foreground mb-1">MX Agent</h2>
      <p className="text-sm text-muted-foreground text-center max-w-sm text-balance">
        Your AI assistant for managing blog content. Ask me to query data, run
        commands, or analyze your site.
      </p>
    </div>
  )
}

export function ChatMessages() {
  const store = useAgentStore()
  const scrollRef = useRef<HTMLDivElement>(null)

  const {
    messages,
    streamingDelta,
    sessionRunning,
    activeToolEvents,
    pendingActions,
  } = store

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, streamingDelta, activeToolEvents.size, pendingActions.length])

  if (!store.activeSessionId && messages.length === 0) {
    return <EmptyState />
  }

  // Filter pending actions that are not already in messages to avoid duplication
  const messageActionIds = new Set(
    messages
      .filter((m) => m.kind === AIAgentMessageKind.ConfirmRequest)
      .map((m) => (m.content as WsConfirmRequest)?.actionId)
      .filter(Boolean),
  )

  const orphanedPendingActions = pendingActions.filter(
    (a) => !messageActionIds.has(a.actionId),
  )

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 pb-4">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {/* Orphans (pending actions not in messages) */}
        {orphanedPendingActions.map((action) => (
          <ToolConfirmCard key={action.actionId} request={action} isPending />
        ))}

        {/* Active tool events */}
        {Array.from(activeToolEvents.values()).map((entry) => (
          <ToolCallCard key={entry.toolUseId} entry={entry} />
        ))}

        {/* Streaming delta */}
        {streamingDelta && <StreamingMessage delta={streamingDelta} />}

        {/* Typing indicator when running but no delta */}
        {sessionRunning &&
          !streamingDelta &&
          activeToolEvents.size === 0 &&
          orphanedPendingActions.length === 0 && <TypingIndicator />}
      </div>
    </div>
  )
}
