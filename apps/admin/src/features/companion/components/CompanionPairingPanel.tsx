import { Check, Clipboard, KeyRound, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import type { CompanionPairingResult } from '~/api/companion'
import { useI18n } from '~/i18n'
import { Badge } from '~/ui/primitives/badge'
import { Button } from '~/ui/primitives/button'
import { Panel } from '~/ui/primitives/panel'

interface CompanionPairingPanelProps {
  isCreating: boolean
  onCopy: (code: string) => void
  onCreate: () => void
  pairing: CompanionPairingResult | null
}

export function CompanionPairingPanel(props: CompanionPairingPanelProps) {
  const { format, t } = useI18n()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!props.pairing) return

    const expiresAt = Date.parse(props.pairing.expiresAt)
    if (expiresAt <= Date.now()) return

    const timer = window.setInterval(() => {
      const nextNow = Date.now()
      setNow(nextNow)
      if (nextNow >= expiresAt) window.clearInterval(timer)
    }, 1_000)

    return () => window.clearInterval(timer)
  }, [props.pairing])

  const remainingSeconds = props.pairing
    ? Math.max(
        0,
        Math.ceil((Date.parse(props.pairing.expiresAt) - now) / 1_000),
      )
    : 0
  const hasActivePairing = Boolean(props.pairing && remainingSeconds > 0)
  const canCreate = !hasActivePairing

  return (
    <Panel
      className="overflow-hidden border border-border bg-surface-card"
      description={t('companion.pairing.description')}
      title={t('companion.pairing.title')}
    >
      <div className="space-y-4 p-4">
        {props.pairing ? (
          <div className="rounded-sm border border-border bg-surface-inset p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-medium text-fg-muted">
                  {t('companion.pairing.codeLabel')}
                </div>
                <code
                  className="mt-2 block select-all font-mono text-2xl font-semibold tracking-[0.18em] text-fg"
                  data-testid="companion-pairing-code"
                >
                  {props.pairing.pairingCode}
                </code>
              </div>
              <Badge tone={hasActivePairing ? 'success' : 'neutral'}>
                {hasActivePairing ? (
                  <Check aria-hidden="true" className="size-3" />
                ) : null}
                <span>
                  {hasActivePairing
                    ? t('companion.pairing.expiresIn', {
                        count: remainingSeconds,
                      })
                    : t('companion.pairing.expired')}
                </span>
                {!hasActivePairing ? (
                  <span aria-live="polite" className="sr-only">
                    {t('companion.pairing.expired')}
                  </span>
                ) : null}
              </Badge>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <p className="text-xs text-fg-muted">
                {t('companion.pairing.expiresAt', {
                  time: format.dateTime(props.pairing.expiresAt),
                })}
              </p>
              <Button
                data-testid="companion-copy-code"
                disabled={!hasActivePairing}
                onClick={() => {
                  if (props.pairing) props.onCopy(props.pairing.pairingCode)
                }}
                type="button"
                variant="secondary"
              >
                <Clipboard aria-hidden="true" className="size-3.5" />
                {t('companion.pairing.copy')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-sm bg-surface-inset p-4">
            <KeyRound
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-fg-subtle"
            />
            <p className="text-sm leading-6 text-fg-muted">
              {t('companion.pairing.empty')}
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-2xl text-xs leading-5 text-fg-muted">
            {t('companion.pairing.showOnce')}
          </p>
          <Button
            data-testid="companion-create-pairing"
            disabled={!canCreate || props.isCreating}
            onClick={props.onCreate}
            type="button"
          >
            {props.isCreating ? (
              <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
            ) : (
              <KeyRound aria-hidden="true" className="size-3.5" />
            )}
            {hasActivePairing
              ? t('companion.pairing.active')
              : props.isCreating
                ? t('companion.pairing.creating')
                : t('companion.pairing.create')}
          </Button>
        </div>
      </div>
    </Panel>
  )
}
