import { useMutation, useQuery } from '@tanstack/react-query'
import { FormEvent, useState } from 'react'
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
import { ModalHeader } from '~/ui/feedback/modal'
import { present, useModal } from '~/ui/feedback/modal-imperative'
import { Button } from '~/ui/primitives/button'
import { Checkbox } from '~/ui/primitives/checkbox'
import { Scroll } from '~/ui/primitives/scroll'
import { Switch } from '~/ui/primitives/switch'
import { TextInput } from '~/ui/primitives/text-field'

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
    onSuccess: (webhook) => {
      toast.success(
        isEdit ? t('webhooks.toast.updated') : t('webhooks.toast.created'),
      )
      modal.close(webhook)
    },
  })

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
    <form className="flex max-h-[90vh] flex-col" onSubmit={handleSubmit}>
      <ModalHeader
        title={
          isEdit
            ? t('webhooks.editor.editTitle')
            : t('webhooks.editor.createTitle')
        }
      />

      <Scroll className="flex-1" innerClassName="grid gap-4 px-5 py-4">
        <TextInput
          label="Payload URL"
          onChange={setPayloadUrl}
          placeholder="https://example.com/webhook"
          required
          value={payloadUrl}
        />
        <TextInput
          label="Secret"
          onChange={setSecret}
          placeholder={
            isEdit
              ? t('webhooks.editor.placeholder.secret.edit')
              : t('webhooks.editor.placeholder.secret.create')
          }
          type="password"
          value={secret}
        />

        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {t('webhooks.editor.events')}{' '}
            <span className="text-red-500">*</span>
          </legend>
          <label className="flex items-center gap-2 rounded border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-800">
            <Checkbox
              checked={allEventsChecked}
              onCheckedChange={(checked) => setEvents(checked ? ['all'] : [])}
            />
            {t('webhooks.editor.allEvents')}
          </label>
          <Scroll
            className="rounded border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/50"
            innerClassName="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2"
            viewportClassName="max-h-56"
          >
            {availableEvents.map((event) => (
              <label className="flex items-center gap-2 text-sm" key={event}>
                <Checkbox
                  checked={allEventsChecked || events.includes(event)}
                  disabled={allEventsChecked}
                  onCheckedChange={(checked) => {
                    setEvents((current) =>
                      checked
                        ? [...current, event]
                        : current.filter((value) => value !== event),
                    )
                  }}
                />
                {event}
              </label>
            ))}
          </Scroll>
        </fieldset>

        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {t('webhooks.editor.scope')}
          </legend>
          <div className="flex flex-wrap gap-3">
            {scopeOptions.map((option) => (
              <label
                className="flex items-center gap-2 text-sm"
                key={option.value}
              >
                <Checkbox
                  checked={(scope & option.value) === option.value}
                  onCheckedChange={(checked) =>
                    setScope((current) =>
                      checked
                        ? current | option.value
                        : current & ~option.value,
                    )
                  }
                />
                {t(option.labelKey)}
              </label>
            ))}
          </div>
        </fieldset>

        <Switch
          checked={enabled}
          label={t('webhooks.editor.enabled')}
          onCheckedChange={setEnabled}
        />

        {error ? <span className="text-xs text-red-500">{error}</span> : null}
      </Scroll>

      <div className="flex items-center justify-end gap-2 border-t border-neutral-200 px-5 py-4 dark:border-neutral-800">
        <Button onClick={() => modal.dismiss()} type="button" variant="subtle">
          {t('common.cancel')}
        </Button>
        <Button disabled={mutation.isPending} type="submit">
          {isEdit ? t('common.save') : t('common.create')}
        </Button>
      </div>
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
        className: 'max-h-[90vh]',
        popupStyle: { width: 'min(92vw, 42rem)' },
      },
    },
  )
  return await handle
}
