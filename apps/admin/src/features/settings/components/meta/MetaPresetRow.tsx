import { GripVertical, Lock } from 'lucide-react'
import type { MetaPresetField } from '~/models/meta-preset'

import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { Switch } from '~/ui/primitives/switch'

import { fieldTypeLabelKeys, scopeLabelKeys } from '../../constants'
import { SmallBadge } from '../SettingsPrimitives'

export function MetaPresetRow(props: {
  onDelete: (id: string) => void
  onEdit: (id: string) => void
  onToggle: (preset: MetaPresetField) => void
  preset: MetaPresetField
}) {
  const { t } = useI18n()
  return (
    <div className="flex items-center gap-3 py-3 pr-4">
      {!props.preset.isBuiltin ? (
        <GripVertical aria-hidden="true" className="size-4 text-neutral-300" />
      ) : (
        <Lock aria-hidden="true" className="size-4 text-neutral-300" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-neutral-950 dark:text-neutral-50">
            {props.preset.label}
          </span>
          <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs text-neutral-500 dark:bg-neutral-900">
            {props.preset.key}
          </code>
          <SmallBadge>{t(fieldTypeLabelKeys[props.preset.type])}</SmallBadge>
          <SmallBadge>{t(scopeLabelKeys[props.preset.scope])}</SmallBadge>
          {props.preset.isBuiltin ? (
            <SmallBadge>{t('settings.meta.builtinBadge')}</SmallBadge>
          ) : null}
        </div>
        {props.preset.description ? (
          <p className="mt-1 truncate text-sm text-neutral-500">
            {props.preset.description}
          </p>
        ) : null}
      </div>
      <Switch
        checked={props.preset.enabled}
        label=""
        onCheckedChange={() => props.onToggle(props.preset)}
      />
      {!props.preset.isBuiltin ? (
        <>
          <Button
            onClick={() => props.onEdit(props.preset.id)}
            type="button"
            variant="subtle"
          >
            {t('common.edit')}
          </Button>
          <Button
            onClick={() => props.onDelete(props.preset.id)}
            type="button"
            variant="subtle"
          >
            {t('common.delete')}
          </Button>
        </>
      ) : null}
    </div>
  )
}
