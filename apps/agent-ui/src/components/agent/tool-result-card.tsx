import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { AIAgentMessage } from '@/types/agent'
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Database,
  Terminal,
  Wrench,
} from 'lucide-react'
import { useState } from 'react'

interface ToolResultCardProps {
  message: AIAgentMessage
}

export function ToolResultCard({ message }: ToolResultCardProps) {
  const [expanded, setExpanded] = useState(false)

  const content = message.content as any
  const toolResult = content?.message || content
  if (!toolResult) return null

  const isError = toolResult.is_error
  const toolName = toolResult.tool_name
  const details = toolResult.details
  const rawOutput = toolResult.content

  const icon = (() => {
    switch (toolName) {
      case 'mongodb': {
        return <Database className="size-3.5" />
      }
      case 'shell': {
        return <Terminal className="size-3.5" />
      }
      default: {
        return <Wrench className="size-3.5" />
      }
    }
  })()

  // Format the output for display
  const displayOutput = (() => {
    if (details && toolName === 'mongodb') {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className="text-[10px] font-mono px-1.5 py-0"
            >
              {details.operation}
            </Badge>
            <span className="text-[10px] text-muted-foreground font-mono">
              {details.collection}
            </span>
          </div>
          <pre className="text-xs text-foreground bg-secondary/50 rounded p-2 overflow-x-auto font-mono">
            {JSON.stringify(details.result, null, 2)}
          </pre>
        </div>
      )
    }

    const text = Array.isArray(rawOutput)
      ? rawOutput.map((c: any) => c.text || '').join('\n')
      : typeof rawOutput === 'string'
        ? rawOutput
        : JSON.stringify(rawOutput, null, 2)

    return (
      <pre
        className={cn(
          'text-xs rounded p-2 overflow-x-auto font-mono',
          isError
            ? 'text-destructive bg-destructive/10'
            : 'text-foreground bg-secondary/50',
        )}
      >
        {text}
      </pre>
    )
  })()

  return (
    <div
      className={cn(
        'my-1 rounded-lg border transition-colors',
        isError
          ? 'border-destructive/20 bg-destructive/5 hover:bg-destructive/10'
          : 'border-border bg-card/50 hover:bg-card',
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left"
      >
        <div
          className={cn(
            'flex size-6 items-center justify-center rounded bg-background border border-border',
            isError
              ? 'text-destructive border-destructive/30'
              : 'text-muted-foreground',
          )}
        >
          {icon}
        </div>

        <div className="flex flex-col min-w-0">
          <span className="text-xs font-medium text-foreground truncate">
            {toolName} {details?.operation ? `· ${details.operation}` : ''}
          </span>
          {details?.collection && (
            <span className="text-[10px] text-muted-foreground truncate">
              {details.collection}
            </span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {isError ? (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 border-destructive/30 text-destructive bg-destructive/10 gap-1"
            >
              <AlertCircle className="size-2.5" />
              Error
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 border-success/30 text-success bg-success/10 gap-1"
            >
              <Check className="size-2.5" />
              Result
            </Badge>
          )}
          {expanded ? (
            <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-3 py-2">{displayOutput}</div>
      )}
    </div>
  )
}
