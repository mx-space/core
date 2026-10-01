import { AlertCircle, Bot, Clock, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import type {
  PublishAiResource,
  PublishAiResourceRequest,
  PublishTaskPayload,
} from '~/api/publish-jobs'
import type { AIConfig } from '~/features/settings/types/settings'
import { useI18n } from '~/i18n'
import type { TranslationKey } from '~/i18n/types'
import { Modal, ModalFooter, ModalHeader } from '~/ui/feedback/modal'
import { Button } from '~/ui/primitives/button'
import { SegmentedControl } from '~/ui/primitives/segmented-control'
import { cn } from '~/utils/cn'

import {
  choicesFromRequests,
  emptyPublishAiChoices,
  type PublishAiChoice,
  type PublishAiChoices,
  publishAiResourceLabels,
  publishAiResourceOrder,
  toPublishAiRequests,
} from './publish-ai-choices'

type ContentFormat = 'lexical' | 'markdown'

export function PublishConfirmationDialog(props: {
  aiConfig?: AIConfig
  contentFormat: ContentFormat
  diverged: boolean
  kind: 'note' | 'page' | 'post'
  onClose: () => void
  onConfirm: (resources: PublishAiResourceRequest[]) => void
  onReviewDiff?: () => void
  otherBranchCount: number
  open: boolean
  operation: PublishTaskPayload['operation']
  pending: boolean
  rememberedResources?: PublishAiResourceRequest[] | null
  savedAt?: string
  validationError: string | null
}) {
  const { t } = useI18n()
  const [choices, setChoices] = useState<PublishAiChoices>(
    emptyPublishAiChoices,
  )

  useEffect(() => {
    if (props.open) setChoices(choicesFromRequests(props.rememberedResources))
  }, [props.open, props.rememberedResources])

  const isAvailable = (resource: PublishAiResource) =>
    !getUnavailableKey(resource, props.aiConfig, props.contentFormat)
  const requests =
    props.kind === 'page' ? [] : toPublishAiRequests(choices, isAvailable)
  const confirm = () => props.onConfirm(requests)
  const choiceOptions: { label: string; value: PublishAiChoice }[] = [
    { label: t('write.publishAi.modeNone'), value: 'none' },
    { label: t('write.publishAi.modeSync'), value: 'sync' },
    { label: t('write.publishAi.modeAsync'), value: 'async' },
  ]
  const namesFor = (mode: 'sync' | 'async') =>
    requests
      .filter((request) => request.mode === mode)
      .map((request) => t(publishAiResourceLabels[request.resource]))

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
            <div className="mt-3 flex flex-col divide-y divide-border rounded-lg border border-border">
              {publishAiResourceOrder.map((resource) => {
                const unavailable = getUnavailableKey(
                  resource,
                  props.aiConfig,
                  props.contentFormat,
                )
                return (
                  <div
                    className={cn(
                      'flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 text-sm',
                      unavailable && 'pointer-events-none opacity-55',
                    )}
                    key={resource}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-fg">
                        {t(publishAiResourceLabels[resource])}
                      </span>
                      {unavailable ? (
                        <span className="mt-0.5 block text-xs text-fg-muted">
                          {t(unavailable)}
                        </span>
                      ) : null}
                    </span>
                    <SegmentedControl
                      aria-label={t(publishAiResourceLabels[resource])}
                      onValueChange={(value) =>
                        setChoices((current) => ({
                          ...current,
                          [resource]: value,
                        }))
                      }
                      options={choiceOptions}
                      value={choices[resource]}
                    />
                  </div>
                )
              })}
            </div>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg bg-surface-inset px-3 py-2.5 text-xs">
              <dt className="text-fg-muted">
                {t('write.publishAi.summaryWait')}
              </dt>
              <dd className="min-w-0 text-fg">
                {namesFor('sync').join('、') ||
                  t('write.publishAi.summaryWaitNone')}
              </dd>
              <dt className="text-fg-muted">
                {t('write.publishAi.summaryLater')}
              </dt>
              <dd className="min-w-0 text-fg">
                {namesFor('async').join('、') ||
                  t('write.publishAi.summaryLaterNone')}
              </dd>
            </dl>
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
          onClick={confirm}
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
