import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAgentStore } from '@/lib/agent-store'
import type { WsConfirmRequest } from '@/types/agent'
import {
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  ShieldAlert,
  X,
} from 'lucide-react'
import { useState } from 'react'

interface ToolConfirmCardProps {
  request: WsConfirmRequest
  isPending?: boolean
}

export function ToolConfirmCard({
  request,
  isPending = true,
}: ToolConfirmCardProps) {
  const [expanded, setExpanded] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const { confirmAction, rejectAction } = useAgentStore()

  const handleConfirm = async () => {
    setConfirming(true)
    try {
      await confirmAction(request.actionId)
    } catch {
      // error set in store
    } finally {
      setConfirming(false)
    }
  }

  const handleReject = async () => {
    setRejecting(true)
    try {
      await rejectAction(request.actionId)
    } catch {
      // error set in store
    } finally {
      setRejecting(false)
    }
  }

  const busy = confirming || rejecting

  return (
    <div className="my-2 rounded-lg border border-warning/30 bg-warning/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-warning/10 transition-colors"
      >
        <ShieldAlert className="size-3.5 text-warning shrink-0" />
        <span className="text-sm font-medium text-warning truncate">
          Confirm Action: {request.toolName}
        </span>
        <Badge
          variant="outline"
          className="ml-auto shrink-0 border-warning/30 bg-warning/10 text-warning text-[10px] px-1.5 py-0"
        >
          {request.riskLevel}
        </Badge>
        {expanded ? (
          <ChevronDown className="size-3.5 text-warning shrink-0" />
        ) : (
          <ChevronRight className="size-3.5 text-warning shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-warning/20 px-3 py-3 space-y-3">
          <div className="text-xs text-warning/80">
            The agent wants to execute a potentially dangerous action. Please
            review the details below.
          </div>

          <div>
            <p className="text-[10px] font-medium text-warning/60 uppercase mb-1">
              Arguments
            </p>
            <pre className="text-xs text-foreground bg-background/50 border border-warning/20 rounded p-2 overflow-x-auto max-h-40 overflow-y-auto font-mono">
              {JSON.stringify(request.arguments, null, 2)}
            </pre>
          </div>

          {request.dryRunPreview && (
            <div>
              <p className="text-[10px] font-medium text-warning/60 uppercase mb-1">
                Impact Preview
              </p>
              <pre className="text-xs text-foreground bg-background/50 border border-warning/20 rounded p-2 overflow-x-auto max-h-32 overflow-y-auto font-mono">
                {JSON.stringify(request.dryRunPreview, null, 2)}
              </pre>
            </div>
          )}

          {isPending && (
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReject}
                disabled={busy}
                className="h-8 text-xs border-warning/30 hover:bg-warning/10 text-warning hover:text-warning"
              >
                {rejecting ? (
                  <Loader2 className="mr-1.5 size-3 animate-spin" />
                ) : (
                  <X className="mr-1.5 size-3" />
                )}
                Reject
              </Button>
              <Button
                size="sm"
                onClick={handleConfirm}
                disabled={busy}
                className="h-8 text-xs bg-warning text-warning-foreground hover:bg-warning/90"
              >
                {confirming ? (
                  <Loader2 className="mr-1.5 size-3 animate-spin" />
                ) : (
                  <Check className="mr-1.5 size-3" />
                )}
                Confirm
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
