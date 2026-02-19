import { Badge } from '@/components/ui/badge'
import type { ToolEventEntry } from '@/lib/agent-store'
import { cn } from '@/lib/utils'
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  Wrench,
} from 'lucide-react'
import { useState } from 'react'

interface ToolCallCardProps {
  entry: ToolEventEntry
}

export function ToolCallCard({ entry }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false)

  const statusIcon = (() => {
    switch (entry.status) {
      case 'running': {
        return (
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
        )
      }
      case 'done': {
        return <Check className="size-3.5 text-success" />
      }
      case 'error': {
        return <AlertCircle className="size-3.5 text-destructive" />
      }
    }
  })()

  const statusLabel = (() => {
    switch (entry.status) {
      case 'running': {
        return 'Running...'
      }
      case 'done': {
        return 'Completed'
      }
      case 'error': {
        return 'Failed'
      }
    }
  })()

  return (
    <div className="my-2 rounded-lg border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-secondary/30 transition-colors"
      >
        <Wrench className="size-3.5 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium text-foreground truncate">
          {entry.toolName}
        </span>
        <Badge
          variant="outline"
          className={cn(
            'ml-auto shrink-0 text-[10px] px-1.5 py-0 gap-1',
            entry.status === 'done' && 'border-success/30 text-success',
            entry.status === 'error' &&
              'border-destructive/30 text-destructive',
            entry.status === 'running' &&
              'border-muted-foreground/30 text-muted-foreground',
          )}
        >
          {statusIcon}
          {statusLabel}
        </Badge>
        {expanded ? (
          <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border px-3 py-2 space-y-2">
          {entry.input != null && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">
                Input
              </p>
              <pre className="text-xs text-foreground bg-secondary rounded p-2 overflow-x-auto max-h-40 overflow-y-auto font-mono">
                {String(JSON.stringify(entry.input, null, 2))}
              </pre>
            </div>
          )}
          {entry.output != null && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">
                Output
              </p>
              <pre className="text-xs text-foreground bg-secondary rounded p-2 overflow-x-auto max-h-40 overflow-y-auto font-mono">
                {typeof entry.output === 'string'
                  ? entry.output
                  : String(JSON.stringify(entry.output, null, 2))}
              </pre>
            </div>
          )}
          {entry.error && (
            <div>
              <p className="text-[10px] font-medium text-destructive uppercase mb-1">
                Error
              </p>
              <pre className="text-xs text-destructive bg-destructive/10 rounded p-2 overflow-x-auto font-mono">
                {entry.error}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
