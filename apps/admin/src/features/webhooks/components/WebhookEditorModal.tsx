import { useMutation, useQuery } from '@tanstack/react-query'
import { CircleAlert, Loader2 } from 'lucide-react'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { toast } from 'sonner'

import type { WebhookModel } from '~/api/webhooks'
import {
  createWebhook,
  EventScope,
  getWebhookEvents,
  updateWebhook,
} from '~/api/webhooks'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'
import { ModalFooter, ModalHeader } from '~/ui/feedback/modal'
import { present, useModal } from '~/ui/feedback/modal-imperative'
import { Button } from '~/ui/primitives/button'
import { Checkbox } from '~/ui/primitives/checkbox'
import { Scroll } from '~/ui/primitives/scroll'
import { Switch } from '~/ui/primitives/switch'
import { TextInput } from '~/ui/primitives/text-field'
import { cn } from '~/utils/cn'

import { scopeOptions } from '../constants'

interface WebhookEditorModalProps {
  webhook: WebhookModel | null
}

function WebhookEditorModal(props: WebhookEditorModalProps) {
  const { t } = useI18n()
  const modal = useModal<WebhookModel>()
  const isEdit = Boolean(props.webhook?.id)

  const [payloadUrl, setPayloadUrl] = useState(
    props.webhook?.payloadUrl || props.webhook?.url || '',
  )
  const [secret, setSecret] = useState('')
  const [enabled, setEnabled] = useState(props.webhook?.enabled ?? true)
  const [scope, setScope] = useState<number>(
    props.webhook?.scope ?? EventScope.TO_SYSTEM,
  )
  const [events, setEvents] = useState<string[]>(props.webhook?.events ?? [])
  const [error, setError] = useState('')

  const eventsQuery = useQuery({
    queryFn: getWebhookEvents,
    queryKey: adminQueryKeys.webhooks.events(),
  })
  const availableEvents = eventsQuery.data ?? []
  const allEventsChecked = events.includes('all')
  const selectedEventCount = allEventsChecked
    ? availableEvents.length
    : events.filter((event) => availableEvents.includes(event)).length
  const someEventsChecked = !allEventsChecked && selectedEventCount > 0
  const clearError = () => setError('')

  const mutation = useMutation({
    mutationFn: async () => {
      const data = {
        enabled,
        events,
        payloadUrl: payloadUrl.trim(),
        scope,
        ...(secret.trim() ? { secret: secret.trim() } : {}),
      }

      if (props.webhook?.id) return updateWebhook(props.webhook.id, data)
      return createWebhook({ ...data, secret: secret.trim() || '' })
    },
    onError: (mutationError: unknown) => {
      setError(
        mutationError instanceof Error && mutationError.message
          ? mutationError.message
          : t('webhooks.editor.saveFailed'),
      )
    },
    onSuccess: (webhook) => {
      toast.success(
        isEdit ? t('webhooks.toast.updated') : t('webhooks.toast.created'),
      )
      modal.close(webhook)
    },
  })
  const submitLabel = isEdit
    ? t(mutation.isPending ? 'webhooks.editor.saving' : 'common.save')
    : t(mutation.isPending ? 'webhooks.editor.creating' : 'common.create')

  const handleSubmit = (event?: FormEvent) => {
    event?.preventDefault()

    if (!payloadUrl.trim()) {
      setError(t('webhooks.editor.validate.urlRequired'))
      return
    }

    if (events.length === 0) {
      setError(t('webhooks.editor.validate.eventRequired'))
      return
    }

    setError('')
    mutation.mutate()
  }

  return (
    <form
      aria-busy={mutation.isPending}
      className="flex h-[min(90svh,52rem)] min-h-0 flex-col"
      onSubmit={handleSubmit}
    >
      <ModalHeader
        title={
          isEdit
            ? t('webhooks.editor.editTitle')
            : t('webhooks.editor.createTitle')
        }
      />

      <Scroll className="flex-1" innerClassName="grid gap-5 px-5 py-5">
        <TextInput
          label="Payload URL"
          onChange={(value) => {
            clearError()
            setPayloadUrl(value)
          }}
          placeholder="https://example.com/webhook"
          required
          value={payloadUrl}
        />
        <TextInput
          label="Secret"
          onChange={(value) => {
            clearError()
            setSecret(value)
          }}
          placeholder={
            isEdit
              ? t('webhooks.editor.placeholder.secret.edit')
              : t('webhooks.editor.placeholder.secret.create')
          }
          type="password"
          value={secret}
        />

        <fieldset className="grid gap-2.5">
          <legend className="text-sm font-medium text-fg">
            {t('webhooks.editor.events')}{' '}
            <span className="text-red-500">*</span>
          </legend>
          <p className="text-xs text-fg-muted">
            {t('webhooks.editor.eventsDescription')}
          </p>
          <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-sm border border-border bg-surface-card px-3 py-2 text-sm text-fg transition-colors hover:bg-surface-inset">
            <Checkbox
              checked={allEventsChecked}
              indeterminate={someEventsChecked}
              onCheckedChange={(checked) => {
                clearError()
                setEvents(checked ? ['all'] : [])
              }}
            />
            <span className="font-medium">
              {t('webhooks.editor.allEvents')}
            </span>
            {!eventsQuery.isPending && availableEvents.length > 0 ? (
              <span className="ml-auto text-xs tabular-nums text-fg-muted">
                {t('webhooks.editor.selectedEvents', {
                  selected: selectedEventCount,
                  total: availableEvents.length,
                })}
              </span>
            ) : null}
          </label>
          <div className="rounded-sm border border-border bg-surface-inset/50 p-1.5">
            {eventsQuery.isPending ? (
              <div className="px-2 py-6 text-center text-sm text-fg-muted">
                {t('common.loading')}
              </div>
            ) : availableEvents.length > 0 ? (
              <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-2">
                {availableEvents.map((event) => (
                  <label
                    className={cn(
                      'flex min-h-9 items-center gap-2 rounded-sm px-2.5 py-2 font-mono text-xs transition-colors',
                      allEventsChecked
                        ? 'cursor-not-allowed text-fg-subtle'
                        : 'cursor-pointer text-fg hover:bg-surface-card',
                    )}
                    key={event}
                  >
                    <Checkbox
                      checked={allEventsChecked || events.includes(event)}
                      disabled={allEventsChecked}
                      onCheckedChange={(checked) => {
                        clearError()
                        setEvents((current) =>
                          checked
                            ? [...current, event]
                            : current.filter((value) => value !== event),
                        )
                      }}
                    />
                    <span className="min-w-0 truncate">{event}</span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="px-2 py-6 text-center text-sm text-fg-muted">
                {eventsQuery.isError
                  ? t('webhooks.editor.eventsLoadFailed')
                  : t('common.empty')}
              </div>
            )}
          </div>
        </fieldset>

        <fieldset className="grid gap-2.5">
          <legend className="text-sm font-medium text-fg">
            {t('webhooks.editor.scope')}
          </legend>
          <p className="text-xs text-fg-muted">
            {t('webhooks.editor.scopeDescription')}
          </p>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">
            {scopeOptions.map((option) => (
              <label
                className="flex min-h-9 cursor-pointer items-center gap-2 rounded-sm px-2.5 py-2 text-sm text-fg transition-colors hover:bg-surface-inset"
                key={option.value}
              >
                <Checkbox
                  checked={(scope & option.value) === option.value}
                  onCheckedChange={(checked) => {
                    clearError()
                    setScope((current) =>
                      checked
                        ? current | option.value
                        : current & ~option.value,
                    )
                  }}
                />
                {t(option.labelKey)}
              </label>
            ))}
          </div>
        </fieldset>

        <Switch
          bordered
          checked={enabled}
          description={t('webhooks.editor.enabledDescription')}
          label={t('webhooks.editor.enabled')}
          onCheckedChange={(checked) => {
            clearError()
            setEnabled(checked)
          }}
        />
      </Scroll>

      {error ? (
        <div
          className="flex shrink-0 items-start gap-2 border-t border-red-500/20 bg-red-500/10 px-5 py-2.5 text-xs text-red-600 dark:text-red-400"
          role="alert"
        >
          <CircleAlert
            aria-hidden="true"
            className="mt-0.5 size-3.5 shrink-0"
          />
          <span className="min-w-0 break-words">{error}</span>
        </div>
      ) : null}

      <ModalFooter>
        <Button onClick={() => modal.dismiss()} type="button" variant="subtle">
          {t('common.cancel')}
        </Button>
        <Button disabled={mutation.isPending} type="submit">
          {mutation.isPending ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : null}
          {submitLabel}
        </Button>
      </ModalFooter>
    </form>
  )
}

/**
 * Open the webhook editor. Resolves with the saved webhook on success.
 */
export async function presentWebhookEditor(
  webhook: WebhookModel | null,
): Promise<WebhookModel | undefined> {
  const handle = present<WebhookEditorModalProps, WebhookModel>(
    WebhookEditorModal,
    { webhook },
    {
      modalProps: {
        className: 'max-h-[90svh]',
        popupStyle: { width: 'min(94vw, 46rem)' },
      },
    },
  )
  return await handle
}
