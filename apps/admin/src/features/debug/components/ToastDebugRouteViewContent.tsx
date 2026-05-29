import { toast } from 'sonner'
import type { ReactNode } from 'react'

import { useI18n } from '~/i18n'
import { AppPage, PageHeader } from '~/ui/layout/page-layout'
import { Button } from '~/ui/primitives/button'
import { Panel } from '~/ui/primitives/panel'
import { Scroll } from '~/ui/primitives/scroll'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function ToastDebugRouteViewContent() {
  const { t } = useI18n()

  return (
    <AppPage>
      <PageHeader
        description={t('debug.toast.headerDescription')}
        title={t('debug.toast.headerTitle')}
      />
      <Scroll
        className="min-h-0 flex-1"
        innerClassName="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4"
      >
        <Panel title={t('debug.toast.basic.title')}>
          <ToastSection title={t('debug.toast.status.title')}>
            <Button
              onClick={() => toast.success(t('debug.toast.error.success'))}
              variant="subtle"
            >
              Success
            </Button>
            <Button
              onClick={() => toast.error(t('debug.toast.error.fail'))}
              variant="subtle"
            >
              {t('debug.toast.error.actionPlus')}
            </Button>
            <Button
              onClick={() => toast.warning(t('debug.toast.error.warning'))}
              variant="subtle"
            >
              Warning
            </Button>
            <Button
              onClick={() => toast.info(t('debug.toast.error.info'))}
              variant="subtle"
            >
              Info
            </Button>
          </ToastSection>

          <ToastSection title={t('debug.toast.description.title')}>
            <Button
              onClick={() => {
                toast.success(t('debug.toast.action.saveSuccess'), {
                  description: t('debug.toast.action.saveDescription'),
                })
              }}
              variant="subtle"
            >
              {t('debug.toast.action.successPlus')}
            </Button>
            <Button
              onClick={() => {
                toast.error(t('debug.toast.action.saveFailed'), {
                  description: t('debug.toast.action.errorDescription'),
                })
              }}
              variant="subtle"
            >
              {t('debug.toast.action.errorPlus')}
            </Button>
          </ToastSection>

          <ToastSection title={t('debug.toast.loading.title')}>
            <Button
              onClick={() => {
                const id = toast.loading(t('debug.toast.action.loadingStart'))
                setTimeout(() => {
                  toast.dismiss(id)
                  toast.success(t('debug.toast.action.loadingDone'))
                }, 2000)
              }}
              variant="subtle"
            >
              {t('debug.toast.action.loadingToSuccess')}
            </Button>
            <Button
              onClick={() => {
                const id = toast.loading(t('debug.toast.action.loadingProcess'))
                setTimeout(() => {
                  toast.dismiss(id)
                  toast.error(t('debug.toast.action.loadingFailed'))
                }, 2000)
              }}
              variant="subtle"
            >
              {t('debug.toast.action.loadingToError')}
            </Button>
          </ToastSection>

          <ToastSection title={t('debug.toast.manual.title')}>
            <Button
              onClick={() => {
                const id = toast.success(t('debug.toast.action.dismissTimer'), {
                  duration: Infinity,
                })
                setTimeout(() => {
                  toast.dismiss(id)
                  toast.info(t('debug.toast.action.dismiss'))
                }, 3000)
              }}
              variant="subtle"
            >
              {t('debug.toast.action.dismissManual')}
            </Button>
          </ToastSection>
        </Panel>

        <Panel title={t('debug.toast.withAction.title')}>
          <ToastSection
            description={t('debug.toast.comment.sectionDescription')}
            title={t('debug.toast.comment.title')}
          >
            <Button
              onClick={() => {
                const id = toast.success(t('debug.toast.comment.new'), {
                  action: {
                    label: t('debug.toast.comment.view'),
                    onClick: () => {
                      toast.dismiss(id)
                      toast.info(t('debug.toast.comment.jump'))
                    },
                  },
                  description: t('debug.toast.comment.description'),
                  duration: 10000,
                })
              }}
              variant="subtle"
            >
              {t('debug.toast.comment.trigger')}
            </Button>
          </ToastSection>

          <ToastSection
            description={t('debug.toast.friend.sectionDescription')}
            title={t('debug.toast.friend.title')}
          >
            <Button
              onClick={() => {
                const id = toast.success(t('debug.toast.friend.new'), {
                  action: {
                    label: t('debug.toast.friend.view'),
                    onClick: () => {
                      toast.dismiss(id)
                      toast.info(t('debug.toast.friend.jump'))
                    },
                  },
                  description: t('debug.toast.friend.description'),
                  duration: 10000,
                })
              }}
              variant="subtle"
            >
              {t('debug.toast.friend.trigger')}
            </Button>
          </ToastSection>

          <ToastSection
            description={t('debug.toast.update.sectionDescription')}
            title={t('debug.toast.update.title')}
          >
            <Button
              onClick={() => {
                toast.info(t('debug.toast.update.new'), {
                  action: {
                    label: t('debug.toast.update.action'),
                    onClick: () =>
                      toast.success(t('debug.toast.update.starting')),
                  },
                  description: t('debug.toast.update.description'),
                  duration: 15000,
                })
              }}
              variant="subtle"
            >
              {t('debug.toast.update.trigger')}
            </Button>
          </ToastSection>

          <ToastSection
            description={t('debug.toast.delete.sectionDescription')}
            title={t('debug.toast.delete.title')}
          >
            <Button
              onClick={() => {
                toast.success(t('debug.toast.delete.fileDeleted'), {
                  action: {
                    label: t('debug.toast.delete.undo'),
                    onClick: () =>
                      toast.success(t('debug.toast.delete.fileRestored')),
                  },
                  description: 'image-2024-01-15.png',
                  duration: 8000,
                })
              }}
              variant="subtle"
            >
              {t('debug.toast.delete.trigger')}
            </Button>
          </ToastSection>

          <ToastSection title={t('debug.toast.retry.title')}>
            <Button
              onClick={() => {
                toast.error(t('debug.toast.action.saveFailed'), {
                  action: {
                    label: t('debug.toast.retry.action'),
                    onClick: () => toast.info(t('debug.toast.retry.retrying')),
                  },
                  description: t('debug.toast.retry.description'),
                  duration: 10000,
                })
              }}
              variant="subtle"
            >
              {t('debug.toast.retry.trigger')}
            </Button>
          </ToastSection>
        </Panel>

        <Panel title={t('debug.toast.business.title')}>
          <ToastSection title={t('debug.toast.business.formTitle')}>
            <Button
              onClick={async () => {
                const id = toast.loading(t('debug.toast.business.submitting'))
                await wait(1500)
                toast.dismiss(id)
                toast.success(t('debug.toast.business.submitSuccess'))
              }}
            >
              {t('debug.toast.business.formSubmit')}
            </Button>
          </ToastSection>

          <ToastSection title={t('debug.toast.business.batchTitle')}>
            <Button
              onClick={async () => {
                const id = toast.loading(t('debug.toast.business.deleting'))
                await wait(1500)
                toast.dismiss(id)
                toast.success(t('debug.toast.business.deletedDone'), {
                  action: {
                    label: t('debug.toast.delete.undo'),
                    onClick: () =>
                      toast.success(t('debug.toast.business.undoBatch')),
                  },
                  description: t('debug.toast.business.deleted'),
                  duration: 10000,
                })
              }}
              variant="subtle"
            >
              {t('debug.toast.business.batchTrigger')}
            </Button>
          </ToastSection>

          <ToastSection title={t('debug.toast.business.syncTitle')}>
            <Button
              onClick={() => {
                toast.warning(t('debug.toast.business.syncWarning'), {
                  action: {
                    label: t('debug.toast.business.refresh'),
                    onClick: () =>
                      toast.info(t('debug.toast.business.refreshing')),
                  },
                  description: t('debug.toast.business.syncDescription'),
                  duration: 10000,
                })
              }}
              variant="subtle"
            >
              {t('debug.toast.business.syncTrigger')}
            </Button>
          </ToastSection>
        </Panel>
      </Scroll>
    </AppPage>
  )
}

interface ToastSectionProps {
  children: ReactNode
  description?: string
  title: string
}

function ToastSection(props: ToastSectionProps) {
  return (
    <section className="border-b border-neutral-100 px-4 py-4 last:border-0 dark:border-neutral-900">
      <h3 className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
        {props.title}
      </h3>
      {props.description ? (
        <p className="mb-3 text-xs text-neutral-400">{props.description}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">{props.children}</div>
    </section>
  )
}
