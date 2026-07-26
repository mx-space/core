import { useI18n } from '~/i18n'
import { TextArea } from '~/ui/primitives/text-field'

interface CoverPromptEditorProps {
  onUsePreset: () => void
  promptText: string
  setPromptText: (value: string) => void
}

export function CoverPromptEditor(props: CoverPromptEditorProps) {
  const { t } = useI18n()

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-fg-muted">
          {t('write.coverGeneration.promptLabel')}
        </span>
        <button
          className="text-xs text-accent hover:underline"
          onClick={props.onUsePreset}
          type="button"
        >
          {t('write.coverGeneration.backToPreset')}
        </button>
      </div>
      <TextArea
        controlClassName="min-h-32 leading-6"
        onChange={props.setPromptText}
        placeholder={t('write.coverGeneration.promptPlaceholder')}
        value={props.promptText}
      />
    </div>
  )
}
