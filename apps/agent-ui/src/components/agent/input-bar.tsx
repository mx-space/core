import { toast } from '@/hooks/use-toast'
import { useAgentStore } from '@/lib/agent-store'
import { ArrowUp, Loader2 } from 'lucide-react'
import { useCallback, useState } from 'react'
import { RichEditor } from './rich-editor'

export function InputBar() {
  const store = useAgentStore()
  const [sending, setSending] = useState(false)

  const handleSubmit = useCallback(
    async (text: string) => {
      if (store.sessionRunning || sending) return
      setSending(true)
      try {
        await store.sendMessage(text)
      } catch (err) {
        toast({
          title: 'Send failed',
          description: (err as Error).message,
          variant: 'destructive',
        })
      } finally {
        setSending(false)
      }
    },
    [store, sending],
  )

  const disabled = store.sessionRunning || sending

  return (
    <div className="border-t border-border bg-background">
      <div className="mx-auto max-w-3xl px-4 py-3">
        <div className="rounded-xl border border-border bg-card overflow-hidden transition-colors focus-within:border-muted-foreground/40">
          <RichEditor
            onSubmit={handleSubmit}
            placeholder="Send a message... (Shift+Enter for new line)"
            className={disabled ? 'pointer-events-none opacity-50' : ''}
          />

          <div className="flex items-center justify-between border-t border-border/50 px-3 py-2">
            <div className="flex items-center gap-2">
              {store.sessionRunning && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" />
                  <span>Agent running...</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                // Enter key plugin handles submission
              }}
              disabled={disabled}
              className="flex size-7 items-center justify-center rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-40"
              aria-label="Send message"
            >
              {sending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowUp className="size-4" />
              )}
            </button>
          </div>
        </div>

        <p className="mt-2 text-center text-[11px] text-muted-foreground/50">
          AI responses are generated. Verify important information before
          publishing.
        </p>
      </div>
    </div>
  )
}
