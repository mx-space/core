import { Loader2, Sparkles } from 'lucide-react'

import { useI18n } from '~/i18n'
import { Drawer } from '~/ui/feedback/drawer'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { SelectField } from '~/ui/primitives/select'
import { TextArea } from '~/ui/primitives/text-field'
import { cn } from '~/utils/cn'

import { CoverGenerationCandidates } from './CoverGenerationCandidates'
import type { useCoverGeneration } from './use-cover-generation'

type CoverGenerationDrawerProps = ReturnType<typeof useCoverGeneration>

export function CoverGenerationDrawer(props: CoverGenerationDrawerProps) {
  const { t } = useI18n()
  const canGenerate = Boolean(props.promptText.trim())

  return (
    <Drawer
      icon={Sparkles}
      onClose={props.closeDrawer}
      open={props.open}
      title={t('write.coverGeneration.title')}
      widthClassName="w-[min(90vw,28rem)]"
    >
      <Scroll className="min-h-0 flex-1" innerClassName="space-y-4 p-4">
        {props.models.length > 0 ? (
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-fg-muted">
              {t('write.coverGeneration.modelLabel')}
            </span>
            <SelectField
              aria-label={t('write.coverGeneration.modelLabel')}
              onValueChange={props.setSelectedModel}
              options={props.models.map((model) => ({
                label: model.name,
                value: model.id,
              }))}
              value={props.selectedModel}
            />
          </div>
        ) : null}

        <div className="space-y-1.5">
          <span className="text-xs font-medium text-fg-muted">
            {t('write.coverGeneration.presetLabel')}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {props.presets.map((preset) => {
              const active = preset.id === props.presetId
              return (
                <button
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    'focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-accent/15',
                    active
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-border bg-surface-card text-fg-muted hover:text-fg',
                  )}
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
        </div>

        <div className="space-y-1.5">
          <TextArea
            controlClassName="min-h-32 leading-6"
            disabled={props.isDraftingPrompt}
            label={t('write.coverGeneration.promptLabel')}
            onChange={props.setPromptText}
            placeholder={t('write.coverGeneration.promptPlaceholder')}
            value={props.promptText}
          />
          {props.isDraftingPrompt ? (
            <p className="inline-flex items-center gap-1.5 text-xs text-fg-muted">
              <Loader2 aria-hidden="true" className="size-3 animate-spin" />
              {t('write.coverGeneration.draftingHint')}
            </p>
          ) : null}
          {!props.canDraftPrompt ? (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {t('write.coverGeneration.needTitleHint')}
            </p>
          ) : null}
        </div>

        <Button
          className="w-full"
          disabled={!canGenerate || props.isGenerating}
          onClick={props.onGenerate}
          type="button"
        >
          {props.isGenerating ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Sparkles aria-hidden="true" className="size-4" />
          )}
          {props.isGenerating
            ? t('write.coverGeneration.generating')
            : t('write.coverGeneration.generate')}
        </Button>

        <div className="space-y-1.5">
          <span className="text-xs font-medium text-fg-muted">
            {t('write.coverGeneration.candidatesTitle')}
          </span>
          <CoverGenerationCandidates
            candidates={props.candidates}
            currentCover={props.currentCover}
            onSelect={props.onSelectCandidate}
          />
        </div>
      </Scroll>
    </Drawer>
  )
}
