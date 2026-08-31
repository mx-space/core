import { AlertCircle, Bot, Clock, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import type { PublishAiResource, PublishTaskPayload } from '~/api/publish-jobs'
import type { AIConfig } from '~/features/settings/types/settings'
import { useI18n } from '~/i18n'
import type { TranslationKey } from '~/i18n/types'
import { Modal, ModalFooter, ModalHeader } from '~/ui/feedback/modal'
import { Button } from '~/ui/primitives/button'
import { Checkbox } from '~/ui/primitives/checkbox'
import { cn } from '~/utils/cn'

const resources: PublishAiResource[] = [
  'summary',
  'insights',
  'translation',
  'tts',
]

type ContentFormat = 'lexical' | 'markdown'

const resourceLabels: Record<PublishAiResource, TranslationKey> = {
  insights: 'ai.overview.capability.insights',
  summary: 'ai.overview.capability.summary',
  translation: 'ai.overview.capability.translation',
  tts: 'ai.overview.capability.tts',
}

export function PublishConfirmationDialog(props: {
  aiConfig?: AIConfig
  contentFormat: ContentFormat
  diverged: boolean
  kind: 'note' | 'page' | 'post'
  onClose: () => void
  onConfirm: (resources: PublishAiResource[]) => void
  onReviewDiff?: () => void
  otherBranchCount: number
  open: boolean
  operation: PublishTaskPayload['operation']
  pending: boolean
  savedAt?: string
  validationError: string | null
}) {
  const { t } = useI18n()
  const [selected, setSelected] = useState<PublishAiResource[]>([])

  useEffect(() => {
    if (props.open) setSelected([])
  }, [props.open])

  const actionKey: TranslationKey =
    props.operation === 'online-update'
      ? 'write.publishProcess.updateOnline'
      : props.operation === 'republish'
        ? 'write.publishProcess.republish'
        : 'write.header.publish'
  const descriptionKey: TranslationKey =
    props.operation === 'online-update'
      ? 'write.publishConfirm.onlineDescription'
      : props.operation === 'republish'
        ? 'write.publishConfirm.republishDescription'
        : 'write.publishConfirm.firstDescription'
  const toggle = (resource: PublishAiResource, checked: boolean) =>
    setSelected((current) =>
      checked
        ? [...new Set([...current, resource])]
        : current.filter((item) => item !== resource),
    )

  return (
    <Modal
      className="h-[min(88svh,42rem)] w-[min(calc(100vw-2rem),38rem)] max-sm:h-svh max-sm:w-screen max-sm:rounded-none"
      onClose={props.onClose}
      open={props.open}
    >
      <ModalHeader
        icon={Bot}
        subtitle={t(descriptionKey)}
        title={t(actionKey)}
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        {props.validationError ? (
          <div className="mb-4 flex gap-2 rounded-lg border border-red-500/25 bg-red-500/8 p-3 text-sm text-red-700 dark:text-red-300">
            <AlertCircle
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
            />
            <span>{props.validationError}</span>
          </div>
        ) : null}

        {props.diverged ? (
          <div className="mb-4 flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
            <AlertCircle
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
            />
            <span>
              {t('write.publishConfirm.diverged', {
                count: props.otherBranchCount,
              })}
            </span>
          </div>
        ) : props.otherBranchCount > 0 ? (
          <div className="mb-4 rounded-lg border border-border bg-surface-inset p-3 text-sm text-fg-muted">
            {t('write.publishConfirm.otherBranchesPreserved', {
              count: props.otherBranchCount,
            })}
          </div>
        ) : null}

        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-inset px-3 py-2.5 text-sm text-fg-muted">
          <Clock aria-hidden="true" className="size-4 shrink-0" />
          <span>
            {props.savedAt
              ? t('write.publishConfirm.savedAt', { time: props.savedAt })
              : t('write.publishConfirm.willSave')}
          </span>
        </div>

        {props.kind !== 'page' ? (
          <section className="mt-5">
            <h3 className="text-sm font-medium text-fg">
              {t('write.publishConfirm.aiTitle')}
            </h3>
            <p className="mt-1 text-xs leading-5 text-fg-muted">
              {t('write.publishConfirm.aiDescription')}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {resources.map((resource) => {
                const unavailable = getUnavailableKey(
                  resource,
                  props.aiConfig,
                  props.contentFormat,
                )
                const checked = selected.includes(resource)
                return (
                  <label
                    className={cn(
                      'flex min-w-0 items-start gap-2 rounded-lg border border-border bg-surface-card px-3 py-3 text-sm',
                      checked && 'border-accent/40 bg-accent-soft',
                      unavailable && 'opacity-55',
                    )}
                    key={resource}
                  >
                    <Checkbox
                      aria-label={t(resourceLabels[resource])}
                      checked={checked}
                      disabled={Boolean(unavailable)}
                      onCheckedChange={(next) => toggle(resource, next)}
                    />
                    <span className="min-w-0">
                      <span className="block font-medium text-fg">
                        {t(resourceLabels[resource])}
                      </span>
                      {unavailable ? (
                        <span className="mt-0.5 block text-xs text-fg-muted">
                          {t(unavailable)}
                        </span>
                      ) : null}
                    </span>
                  </label>
                )
              })}
            </div>
          </section>
        ) : null}
      </div>
      <ModalFooter>
        {props.diverged && props.onReviewDiff ? (
          <Button
            onClick={props.onReviewDiff}
            type="button"
            variant="secondary"
          >
            {t('write.recovery.compareAction')}
          </Button>
        ) : null}
        <Button onClick={props.onClose} type="button" variant="ghost">
          {t('common.cancel')}
        </Button>
        <Button
          disabled={Boolean(props.validationError) || props.pending}
          onClick={() => props.onConfirm(selected)}
          type="button"
        >
          {props.pending ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : null}
          {t(actionKey)}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

function getUnavailableKey(
  resource: PublishAiResource,
  config: AIConfig | undefined,
  contentFormat: ContentFormat,
): TranslationKey | undefined {
  if (resource === 'tts' && contentFormat !== 'lexical') {
    return 'write.publishAi.ttsRequiresLexical'
  }
  if (!config) return 'write.publishAi.unavailable'
  if (resource === 'summary' && !config.enableSummary) {
    return 'write.publishAi.unavailable'
  }
  if (resource === 'insights' && !config.enableInsights) {
    return 'write.publishAi.unavailable'
  }
  if (resource === 'translation') {
    if (!config.enableTranslation) return 'write.publishAi.unavailable'
    if (!config.translationTargetLanguages?.length) {
      return 'write.publishAi.translationRequiresLanguages'
    }
  }
  if (resource === 'tts' && !config.tts?.enable) {
    return 'write.publishAi.unavailable'
  }
  return undefined
}
