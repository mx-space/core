import type { ImagePreset } from '~/api/ai-image'
import { useI18n } from '~/i18n'
import { cn } from '~/utils/cn'

import type { CoverGenerationMode } from './use-cover-generation'

interface CoverPresetPickerProps {
  mode: CoverGenerationMode
  presetId: string
  presets: ImagePreset[]
  presetsLoading: boolean
  setPresetId: (id: string) => void
}

export function CoverPresetPicker(props: CoverPresetPickerProps) {
  const { t } = useI18n()
  const inactive = props.mode === 'manual'

  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-fg-muted">
        {t('write.coverGeneration.presetLabel')}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {props.presets.map((preset) => {
          const active = !inactive && preset.id === props.presetId
          return (
            <button
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                'focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-accent/15',
                inactive
                  ? 'cursor-not-allowed border-border bg-surface-inset text-fg-subtle'
                  : active
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-border bg-surface-card text-fg-muted hover:text-fg',
              )}
              disabled={inactive}
              key={preset.id}
              onClick={() => props.setPresetId(preset.id)}
              type="button"
            >
              {preset.label}
            </button>
          )
        })}
        {props.presets.length === 0 ? (
          <span className="text-xs text-fg-subtle">
            {props.presetsLoading
              ? t('write.coverGeneration.presetsLoading')
              : t('write.coverGeneration.presetsEmpty')}
          </span>
        ) : null}
      </div>
      {inactive ? (
        <p className="text-xs text-fg-subtle">
          {t('write.coverGeneration.leftPresetHint')}
        </p>
      ) : null}
    </div>
  )
}
