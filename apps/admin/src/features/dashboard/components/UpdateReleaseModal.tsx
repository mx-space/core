import { useQuery } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'

import { getReleaseDetails } from '~/api/github-update'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'
import { ModalHeader } from '~/ui/feedback/modal'
import { present } from '~/ui/feedback/modal-imperative'
import { Badge } from '~/ui/primitives/badge'
import { Button } from '~/ui/primitives/button'
import { MarkdownRender } from '~/ui/primitives/markdown-render'
import { Scroll } from '~/ui/primitives/scroll'

import type { ReleaseModalState } from '../types/dashboard'
import { formatDateTime } from '../utils/dashboard'

interface UpdateReleaseModalProps {
  release: ReleaseModalState
}

function UpdateReleaseModal(props: UpdateReleaseModalProps) {
  const { t } = useI18n()
  const releaseQuery = useQuery({
    queryFn: () => getReleaseDetails(props.release.repo, props.release.version),
    queryKey: adminQueryKeys.dashboard.releaseDetail({
      repo: props.release.repo,
      version: props.release.version,
    }),
    retry: false,
  })
  const details = releaseQuery.data

  return (
    <div className="flex max-h-[min(86vh,42rem)] w-full flex-col">
      <ModalHeader
        title={props.release.title || t('dashboard.release.fallbackTitle')}
      />
      <Scroll className="min-h-0 flex-1" innerClassName="p-4">
        {releaseQuery.isLoading ? (
          <div className="py-10 text-center text-sm text-neutral-500">
            {t('dashboard.release.loading')}
          </div>
        ) : details ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">
                  {details.name || details.tagName}
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                  <Badge size="sm" variant="outline">
                    {details.tagName}
                  </Badge>
                  <span>
                    {t('dashboard.release.publishedAt', {
                      date: formatDateTime(details.publishedAt || ''),
                    })}
                  </span>
                </div>
              </div>
              <Button
                onClick={() => window.open(details.htmlUrl, '_blank')}
                type="button"
                variant="subtle"
              >
                <ExternalLink aria-hidden="true" className="size-4" />
                {t('dashboard.release.viewOnGitHub')}
              </Button>
            </div>
            {details.body ? (
              <MarkdownRender
                className="rounded-sm border border-border bg-surface-inset p-4"
                text={details.body}
              />
            ) : (
              <div className="py-8 text-center text-sm text-neutral-500">
                {t('dashboard.release.empty')}
              </div>
            )}
          </div>
        ) : (
          <div className="py-10 text-center text-sm text-neutral-500">
            {t('dashboard.release.error')}
          </div>
        )}
      </Scroll>
    </div>
  )
}

/**
 * Open the release-detail modal.
 */
export function presentUpdateRelease(release: ReleaseModalState) {
  return present<UpdateReleaseModalProps>(
    UpdateReleaseModal,
    { release },
    {
      modalProps: {
        className: 'max-h-[min(86vh,42rem)]',
        popupStyle: { width: 'min(92vw, 40rem)' },
      },
    },
  )
}
