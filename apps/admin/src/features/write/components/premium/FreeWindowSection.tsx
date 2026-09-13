import { useState } from 'react'

import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { DateTimePicker } from '~/ui/primitives/datetime-picker'
import { SegmentedControl } from '~/ui/primitives/segmented-control'
import { TextInput } from '~/ui/primitives/text-field'

import type { PremiumStatus } from './premium-status'

const PRESETS = ['0', '24', '48', '72', '168'] as const
const CUSTOM = 'custom'
type Preset = (typeof PRESETS)[number] | typeof CUSTOM

const PRESET_LABEL = {
  '0': 'write.premium.freeWindow.preset.immediately',
  '24': 'write.premium.freeWindow.preset.h24',
  '48': 'write.premium.freeWindow.preset.h48',
  '72': 'write.premium.freeWindow.preset.h72',
  '168': 'write.premium.freeWindow.preset.d7',
  [CUSTOM]: 'write.premium.freeWindow.preset.custom',
} as const

function isPreset(value: string): value is (typeof PRESETS)[number] {
  return (PRESETS as readonly string[]).includes(value)
}

function toDatetimeLocal(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16)
}

function fromDatetimeLocal(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

function hoursFromNow(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
}

function PendingControls(props: {
  freeWindowHours: string
  onChange: (value: string) => void
}) {
  const { t } = useI18n()
  const [custom, setCustom] = useState(!isPreset(props.freeWindowHours))
  const selected: Preset =
    !custom && isPreset(props.freeWindowHours) ? props.freeWindowHours : CUSTOM

  return (
    <>
      <SegmentedControl<Preset>
        aria-label={t('write.premium.freeWindow.title')}
        fill
        onValueChange={(next) => {
          if (next === CUSTOM) {
            setCustom(true)
            return
          }
          setCustom(false)
          props.onChange(next)
        }}
        options={[...PRESETS, CUSTOM].map((value) => ({
          label: t(PRESET_LABEL[value as Preset]),
          value: value as Preset,
        }))}
        value={selected}
      />
      {selected === CUSTOM ? (
        <TextInput
          controlClassName="h-9 focus:border-neutral-400"
          inputMode="numeric"
          min={0}
          type="number"
          label={t('write.premium.freeWindow.customHours')}
          onChange={props.onChange}
          value={props.freeWindowHours}
        />
      ) : null}
    </>
  )
}

function PublishedControls(props: {
  freeUntil: string
  onChange: (value: string) => void
  status: PremiumStatus
}) {
  const { t } = useI18n()
  const [editing, setEditing] = useState(false)
  const inWindow = props.status.kind === 'free-window'
  const extend = (hours: number) => {
    const base = new Date(props.freeUntil).getTime()
    props.onChange(new Date(base + hours * 60 * 60 * 1000).toISOString())
  }
  const actions: Array<[string, () => void]> = inWindow
    ? [
        [t('write.premium.freeWindow.extend24'), () => extend(24)],
        [t('write.premium.freeWindow.extend72'), () => extend(72)],
        [t('write.premium.freeWindow.editTime'), () => setEditing(true)],
        [
          t('write.premium.freeWindow.endNow'),
          () => props.onChange(new Date().toISOString()),
        ],
      ]
    : [
        [
          t('write.premium.freeWindow.reopen24'),
          () => props.onChange(hoursFromNow(24)),
        ],
        [
          t('write.premium.freeWindow.reopen72'),
          () => props.onChange(hoursFromNow(72)),
        ],
        [t('write.premium.freeWindow.reopenCustom'), () => setEditing(true)],
      ]

  return (
    <>
      <div className="grid grid-cols-2 gap-1.5">
        {actions.map(([label, run]) => (
          <Button key={label} onClick={run} variant="secondary">
            {label}
          </Button>
        ))}
      </div>
      {editing ? (
        <DateTimePicker
          label={t('write.premium.freeWindow.until')}
          onChange={(value) => props.onChange(fromDatetimeLocal(value))}
          value={toDatetimeLocal(props.freeUntil)}
        />
      ) : null}
    </>
  )
}

export function FreeWindowSection(props: {
  freeUntil: string
  freeWindowHours: string
  onFreeUntilChange: (value: string) => void
  onFreeWindowHoursChange: (value: string) => void
  status: PremiumStatus
}) {
  const { t } = useI18n()

  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium text-fg">
        {t('write.premium.freeWindow.title')}
      </span>
      {props.status.kind === 'pending' ? (
        <PendingControls
          freeWindowHours={props.freeWindowHours}
          onChange={props.onFreeWindowHoursChange}
        />
      ) : (
        <PublishedControls
          freeUntil={props.freeUntil}
          onChange={props.onFreeUntilChange}
          status={props.status}
        />
      )}
    </div>
  )
}
