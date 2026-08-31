import { GitCompare, Trash2 } from 'lucide-react'

import { MarkdownDraftDiffPanel } from '~/features/drafts/components/MarkdownDraftDiffPanel'
import { RichDraftDiffPanel } from '~/features/drafts/components/RichDraftDiffPanel'
import { useI18n } from '~/i18n'
import { Drawer } from '~/ui/feedback/drawer'
import { Button } from '~/ui/primitives/button'
import { Scroll } from '~/ui/primitives/scroll'

export interface DraftRecoveryField {
  ancestor?: string
  current: string
  draft: string
  label: string
}

export interface DraftRecoveryReviewData {
  ancestorContent?: string
  ancestorText?: string
  bodyChanged: boolean
  currentContent?: string
  currentText: string
  draftContent?: string
  draftText: string
  fields: DraftRecoveryField[]
  diverged: boolean
  rich: boolean
  savedAt: string
}

export function DraftRecoveryReview(props: {
  data: DraftRecoveryReviewData | null
  onClose: () => void
  onContinue: () => void
  onDelete: () => void
  open: boolean
}) {
  const { t } = useI18n()
  const data = props.data

  return (
    <Drawer
      bodyClassName="bg-background"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <Button
            className="text-red-600 hover:text-red-700 dark:text-red-400"
            onClick={props.onDelete}
            type="button"
            variant="ghost"
          >
            <Trash2 aria-hidden="true" className="size-4" />
            {t('write.recovery.deleteAction')}
          </Button>
          <Button onClick={props.onContinue} type="button">
            {t('write.recovery.continueAction')}
          </Button>
        </div>
      }
      icon={GitCompare}
      onClose={props.onClose}
      open={props.open}
      title={t('write.recovery.review.title')}
      widthClassName="w-full sm:w-[min(92vw,68rem)]"
    >
      {data ? (
        <Scroll className="min-h-0 flex-1">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-6">
            <section className="rounded-lg border border-border bg-surface-card p-4">
              <p className="text-sm font-medium text-fg">
                {t('write.recovery.review.summary', {
                  body: data.bodyChanged
                    ? t('write.recovery.review.bodyChanged')
                    : t('write.recovery.review.bodyUnchanged'),
                  count: data.fields.length,
                })}
              </p>
              <p className="mt-1 text-xs text-fg-muted">
                {t('write.recovery.review.savedAt', { time: data.savedAt })}
              </p>
            </section>

            {data.fields.length ? (
              <section>
                <h3 className="mb-2 text-sm font-medium text-fg">
                  {t('write.recovery.review.fieldsTitle')}
                </h3>
                <div className="overflow-hidden rounded-lg border border-border bg-surface-card">
                  <div
                    className={
                      data.diverged
                        ? 'grid grid-cols-[minmax(7rem,0.7fr)_repeat(3,minmax(0,1fr))] border-b border-border bg-surface-inset px-3 py-2 text-xs font-medium text-fg-muted'
                        : 'grid grid-cols-[minmax(7rem,0.7fr)_minmax(0,1fr)_minmax(0,1fr)] border-b border-border bg-surface-inset px-3 py-2 text-xs font-medium text-fg-muted'
                    }
                  >
                    <span>{t('write.recovery.review.field')}</span>
                    {data.diverged ? (
                      <span>{t('write.recovery.review.ancestor')}</span>
                    ) : null}
                    <span>{t('write.recovery.review.current')}</span>
                    <span>{t('write.recovery.review.draft')}</span>
                  </div>
                  {data.fields.map((field) => (
                    <div
                      className={
                        data.diverged
                          ? 'grid grid-cols-[minmax(7rem,0.7fr)_repeat(3,minmax(0,1fr))] border-b border-border px-3 py-3 text-sm last:border-b-0'
                          : 'grid grid-cols-[minmax(7rem,0.7fr)_minmax(0,1fr)_minmax(0,1fr)] border-b border-border px-3 py-3 text-sm last:border-b-0'
                      }
                      key={field.label}
                    >
                      <span className="font-medium text-fg">{field.label}</span>
                      {data.diverged ? (
                        <span className="min-w-0 break-words pr-3 text-fg-muted">
                          {field.ancestor || '—'}
                        </span>
                      ) : null}
                      <span className="min-w-0 break-words pr-3 text-fg-muted">
                        {field.current || '—'}
                      </span>
                      <span className="min-w-0 break-words text-fg">
                        {field.draft || '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {data.bodyChanged ? (
              <section>
                <h3 className="mb-2 text-sm font-medium text-fg">
                  {t('write.recovery.review.bodyTitle')}
                </h3>
                {data.diverged && data.ancestorText !== undefined ? (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {data.rich &&
                    data.ancestorContent &&
                    data.currentContent &&
                    data.draftContent ? (
                      <>
                        <RichDraftDiffPanel
                          comparisonLabel={t(
                            'write.recovery.review.ancestorToOnline',
                          )}
                          currentContent={data.currentContent}
                          selectedContent={data.ancestorContent}
                        />
                        <RichDraftDiffPanel
                          comparisonLabel={t(
                            'write.recovery.review.ancestorToDraft',
                          )}
                          currentContent={data.draftContent}
                          selectedContent={data.ancestorContent}
                        />
                      </>
                    ) : (
                      <>
                        <MarkdownDraftDiffPanel
                          comparisonLabel={t(
                            'write.recovery.review.ancestorToOnline',
                          )}
                          currentLabel={t('write.recovery.review.currentFile')}
                          currentText={data.currentText}
                          selectedLabel={t(
                            'write.recovery.review.ancestorFile',
                          )}
                          selectedText={data.ancestorText}
                        />
                        <MarkdownDraftDiffPanel
                          comparisonLabel={t(
                            'write.recovery.review.ancestorToDraft',
                          )}
                          currentLabel={t('write.recovery.review.draftFile')}
                          currentText={data.draftText}
                          selectedLabel={t(
                            'write.recovery.review.ancestorFile',
                          )}
                          selectedText={data.ancestorText}
                        />
                      </>
                    )}
                  </div>
                ) : data.rich && data.currentContent && data.draftContent ? (
                  <RichDraftDiffPanel
                    comparisonLabel={t('write.recovery.review.direction')}
                    currentContent={data.draftContent}
                    selectedContent={data.currentContent}
                  />
                ) : (
                  <MarkdownDraftDiffPanel
                    comparisonLabel={t('write.recovery.review.direction')}
                    currentLabel={t('write.recovery.review.draftFile')}
                    currentText={data.draftText}
                    selectedLabel={t('write.recovery.review.currentFile')}
                    selectedText={data.currentText}
                  />
                )}
              </section>
            ) : null}
          </div>
        </Scroll>
      ) : null}
    </Drawer>
  )
}
