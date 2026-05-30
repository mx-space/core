import { Code2, RadioTower, SendHorizontal } from 'lucide-react'
import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { postJson } from '~/api/http'
import { useLocalStorageState } from '~/hooks/use-local-storage-state'
import { useI18n } from '~/i18n'
import { EventTypes } from '~/socket/types'
import { AppPage, PageHeader } from '~/ui/layout/page-layout'
import { Button } from '~/ui/primitives/button'
import { Panel } from '~/ui/primitives/panel'
import { Scroll } from '~/ui/primitives/scroll'
import { SelectField } from '~/ui/primitives/select'
import { TextArea } from '~/ui/primitives/text-field'

type DebugTarget = 'admin' | 'all' | 'web'
type PayloadMap = Partial<Record<EventTypes, string>>

const targetOptions: DebugTarget[] = ['web', 'all', 'admin']
const defaultPayload = 'export default {}'

export function EventsDebugRouteViewContent() {
  const { t } = useI18n()
  const [event, setEvent] = useLocalStorageState<EventTypes>(
    'debug-event-name',
    EventTypes.POST_CREATE,
  )
  const [payloadMap, setPayloadMap] = useLocalStorageState<PayloadMap>(
    'debug-event',
    {},
  )
  const [target, setTarget] = useLocalStorageState<DebugTarget>(
    'debug-event-type',
    'web',
  )
  const [isSending, setIsSending] = useState(false)

  const eventOptions = useMemo(() => Object.values(EventTypes), [])
  const payload = payloadMap[event] ?? defaultPayload

  const updatePayload = (nextPayload: string) => {
    setPayloadMap({
      ...payloadMap,
      [event]: nextPayload,
    })
  }

  const sendEvent = async () => {
    setIsSending(true)

    try {
      const parsedPayload = parseDebugPayload(payload)

      await postJson<void, { payload: unknown; type: string }>(
        '/debug/events',
        {
          payload: parsedPayload,
          type: `${target}:${event}`,
        },
      )
      toast.success(t('debug.events.sendSuccess'), {
        description: `${target}:${event}`,
      })
    } catch (error) {
      toast.error(t('debug.events.sendFailed'), {
        description: readErrorMessage(error, t('debug.events.unknownError')),
      })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <AppPage>
      <PageHeader
        description={t('debug.events.headerDescription')}
        title={t('debug.events.headerTitle')}
      />
      <Scroll
        className="min-h-0 flex-1"
        innerClassName="mx-auto grid w-full max-w-6xl gap-6 p-4 xl:grid-cols-[320px_minmax(0,1fr)]"
      >
        <Panel
          description={t('debug.events.panelDescription')}
          title={t('debug.events.panelTitle')}
        >
          <div className="flex flex-col gap-5 p-4">
            <Field label={t('debug.events.field.target')}>
              <SelectField<DebugTarget>
                onValueChange={setTarget}
                options={targetOptions.map((value) => ({
                  label: value,
                  value,
                }))}
                value={target}
              />
            </Field>

            <Field label={t('debug.events.field.event')}>
              <SelectField<EventTypes>
                onValueChange={setEvent}
                options={eventOptions.map((value) => ({
                  label: value,
                  value,
                }))}
                value={event}
              />
            </Field>

            <div className="rounded-sm border border-border bg-surface-inset p-3 text-xs leading-5 text-fg-muted">
              <RadioTower aria-hidden="true" className="mb-2 size-4" />
              <div className="font-medium text-fg">
                {target}:{event}
              </div>
              <div className="mt-1">{t('debug.events.placeholderHint')}</div>
            </div>

            <Button disabled={isSending} onClick={sendEvent} type="button">
              <SendHorizontal aria-hidden="true" className="size-4" />
              {isSending ? t('debug.events.sending') : t('debug.events.send')}
            </Button>
          </div>
        </Panel>

        <Panel
          description={t('debug.events.payloadDescription')}
          title={
            <span className="inline-flex items-center gap-2">
              <Code2 aria-hidden="true" className="size-4" />
              {t('debug.events.payloadTitle')}
            </span>
          }
        >
          <div className="p-4">
            <TextArea
              controlClassName="min-h-[520px] resize-y p-3 font-mono text-sm leading-6"
              onChange={updatePayload}
              spellCheck={false}
              value={payload}
            />
          </div>
        </Panel>
      </Scroll>
    </AppPage>
  )
}

function Field(props: { children: ReactNode; label: string }) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="text-xs font-medium uppercase tracking-wide text-fg-muted">
        {props.label}
      </span>
      {props.children}
    </label>
  )
}

function parseDebugPayload(source: string) {
  const replacedSource = source.replaceAll(
    // eslint-disable-next-line unicorn/better-regex
    /(\{\{(.*?)\}\})/g,
    (_match, _placeholder, type: string) => generateFakeData(type),
  )

  return new Function(
    `return ${replacedSource.replace(/^export default\s+/, '')}`,
  )()
}

function generateFakeData(type: string) {
  switch (type) {
    case 'objectId': {
      return createObjectId()
    }
    case 'now': {
      return new Date().toISOString()
    }
    case 'randomtext': {
      return btoa(Math.random().toString()).slice(5, 10)
    }
    case 'randomnumber': {
      return String(Math.floor(Math.random() * 10000))
    }
    default: {
      return `{{${type}}}`
    }
  }
}

function createObjectId() {
  const hex = '0123456789abcdef'
  const timestamp = Math.floor(Date.now() / 1000).toString(16)
  const random = Array.from(
    { length: 16 },
    () => hex[Math.floor(Math.random() * hex.length)],
  ).join('')

  return timestamp + random
}

function readErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}
