import { Loader2, Sparkles } from 'lucide-react'
import { Link } from 'react-router'

import { useI18n } from '~/i18n'
import { Drawer } from '~/ui/feedback/drawer'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'
import { SelectField } from '~/ui/primitives/select'

import { CoverGenerationCandidates } from './CoverGenerationCandidates'
import { CoverPresetPicker } from './CoverPresetPicker'
import { CoverPromptEditor } from './CoverPromptEditor'
import type { useCoverGeneration } from './use-cover-generation'

type CoverGenerationDrawerProps = ReturnType<typeof useCoverGeneration>

export function CoverGenerationDrawer(props: CoverGenerationDrawerProps) {
  const { t } = useI18n()

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

        <CoverPresetPicker
          mode={props.mode}
          presetId={props.presetId}
          presets={props.presets}
          presetsLoading={props.presetsLoading}
          setPresetId={props.setPresetId}
        />

        {props.mode === 'manual' ? (
          <CoverPromptEditor
            onUsePreset={props.onUsePreset}
            promptText={props.promptText}
            setPromptText={props.setPromptText}
          />
        ) : (
          <div className="space-y-1.5">
            <Button
              className="w-full"
              disabled={!props.canDraftPrompt || props.isDraftingPrompt}
              onClick={props.onViewEditPrompt}
              type="button"
              variant="secondary"
            >
              {props.isDraftingPrompt ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : null}
              {props.isDraftingPrompt
                ? t('write.coverGeneration.draftingHint')
                : t('write.coverGeneration.viewEditPrompt')}
            </Button>
            {!props.canDraftPrompt ? (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {t('write.coverGeneration.needTitleHint')}
              </p>
            ) : null}
            {props.writerProviderMissing ? (
              <p className="text-xs leading-5 text-amber-600 dark:text-amber-400">
                {t('write.coverGeneration.writerProviderMissingHint')}{' '}
                <Link
                  className="underline underline-offset-2 hover:text-fg"
                  to="/setting/ai"
                >
                  {t('write.coverGeneration.writerProviderMissingLink')}
                </Link>{' '}
                <button
                  className="underline underline-offset-2 hover:text-fg"
                  onClick={props.onWriteManually}
                  type="button"
                >
                  {t('write.coverGeneration.writeManuallyLink')}
                </button>
              </p>
            ) : null}
          </div>
        )}

        <Button
          className="w-full"
          disabled={!props.canGenerate || props.isGenerating}
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
