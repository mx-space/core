import { Select } from '@base-ui/react/select'
import { ChevronDown, Code2, RadioTower, SendHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { ReactNode } from 'react'

import { postJson } from '~/api/http'
import { useLocalStorageState } from '~/hooks/use-local-storage-state'
import { useI18n } from '~/i18n'
import { EventTypes } from '~/socket/types'
import { AppPage, PageHeader } from '~/ui/layout/page-layout'
import { Button } from '~/ui/primitives/button'
import { Panel } from '~/ui/primitives/panel'
import { Scroll } from '~/ui/primitives/scroll'
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
              <Select.Root
                items={targetOptions.map((value) => ({
                  label: value,
                  value,
                }))}
                onValueChange={(value: unknown) => {
                  if (isDebugTarget(value)) setTarget(value)
                }}
                value={target}
              >
                <SelectTrigger />
                <Select.Portal>
                  <Select.Positioner
                    alignItemWithTrigger={false}
                    sideOffset={6}
                  >
                    <Select.Popup className="outline-hidden z-50 min-w-40 rounded border border-neutral-200 bg-white text-sm shadow-lg dark:border-neutral-800 dark:bg-neutral-950">
                      <Scroll innerClassName="p-1">
                        {targetOptions.map((value) => (
                          <Select.Item
                            className="outline-hidden cursor-pointer rounded px-2 py-1.5 text-neutral-700 data-[highlighted]:bg-neutral-100 data-[selected]:text-[var(--color-primary)] dark:text-neutral-200 dark:data-[highlighted]:bg-neutral-800"
                            key={value}
                            value={value}
                          >
                            {value}
                          </Select.Item>
                        ))}
                      </Scroll>
                    </Select.Popup>
                  </Select.Positioner>
                </Select.Portal>
              </Select.Root>
            </Field>

            <Field label={t('debug.events.field.event')}>
              <Select.Root
                items={eventOptions.map((value) => ({
                  label: value,
                  value,
                }))}
                onValueChange={(value: unknown) => {
                  if (isEventType(value)) setEvent(value)
                }}
                value={event}
              >
                <SelectTrigger />
                <Select.Portal>
                  <Select.Positioner
                    alignItemWithTrigger={false}
                    sideOffset={6}
                  >
                    <Select.Popup className="outline-hidden z-50 min-w-56 rounded border border-neutral-200 bg-white text-sm shadow-lg dark:border-neutral-800 dark:bg-neutral-950">
                      <Scroll
                        className="max-h-72"
                        innerClassName="p-1"
                        viewportClassName="max-h-72"
                      >
                        {eventOptions.map((value) => (
                          <Select.Item
                            className="outline-hidden cursor-pointer rounded px-2 py-1.5 text-neutral-700 data-[highlighted]:bg-neutral-100 data-[selected]:text-[var(--color-primary)] dark:text-neutral-200 dark:data-[highlighted]:bg-neutral-800"
                            key={value}
                            value={value}
                          >
                            {value}
                          </Select.Item>
                        ))}
                      </Scroll>
                    </Select.Popup>
                  </Select.Positioner>
                </Select.Portal>
              </Select.Root>
            </Field>

            <div className="rounded border border-neutral-200 bg-neutral-50 p-3 text-xs leading-5 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-400">
              <RadioTower aria-hidden="true" className="mb-2 size-4" />
              <div className="font-medium text-neutral-700 dark:text-neutral-200">
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
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {props.label}
      </span>
      {props.children}
    </label>
  )
}

function SelectTrigger() {
  return (
    <Select.Trigger className="outline-hidden flex h-10 w-full items-center justify-between gap-2 rounded border border-neutral-200 bg-white px-3 text-left text-sm text-neutral-900 transition-colors hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-[var(--color-primary-shallow)] dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:bg-neutral-900">
      <Select.Value>{(value: unknown) => String(value ?? '')}</Select.Value>
      <ChevronDown
        aria-hidden="true"
        className="size-4 shrink-0 text-neutral-400"
      />
    </Select.Trigger>
  )
}

function parseDebugPayload(source: string) {
  const replacedSource = source.replace(
    /({{(.*?)}})/g,
    (_match, _placeholder, type: string) => generateFakeData(type),
  )

  return new Function(
    `return ${replacedSource.replace(/^export default\s+/, '')}`,
  )()
}

function generateFakeData(type: string) {
  switch (type) {
    case 'objectId':
      return createObjectId()
    case 'now':
      return new Date().toISOString()
    case 'randomtext':
      return btoa(Math.random().toString()).slice(5, 10)
    case 'randomnumber':
      return String(Math.floor(Math.random() * 10000))
    default:
      return `{{${type}}}`
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

function isDebugTarget(value: unknown): value is DebugTarget {
  return (
    typeof value === 'string' && targetOptions.includes(value as DebugTarget)
  )
}

function isEventType(value: unknown): value is EventTypes {
  return (
    typeof value === 'string' &&
    (Object.values(EventTypes) as string[]).includes(value)
  )
}

function readErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}
