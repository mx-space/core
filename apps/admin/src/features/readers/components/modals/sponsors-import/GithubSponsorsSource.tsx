import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'

import type { GithubSponsorModel } from '~/api/readers'
import { getGithubSponsors } from '~/api/readers'
import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { cn } from '~/utils/cn'

import type { SponsorEntry, SponsorSourceState } from './types'

export const githubSponsorsQueryKey = ['readers', 'github-sponsors'] as const

const toEntry = (sponsor: GithubSponsorModel): SponsorEntry => ({
  key: `github:${sponsor.githubId}`,
  title: sponsor.login,
  subtitle: sponsor.tierName,
  avatarUrl: sponsor.avatarUrl,
  badge: sponsor.isActive ? 'active' : 'past',
  months: null,
  reader: sponsor.reader,
})

export function GithubSponsorsSource(props: {
  children: (state: SponsorSourceState) => ReactNode
}) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const query = useQuery({
    queryFn: () => getGithubSponsors(),
    queryKey: githubSponsorsQueryKey,
  })

  const refresh = async () => {
    await queryClient.fetchQuery({
      queryFn: () => getGithubSponsors(true),
      queryKey: githubSponsorsQueryKey,
      staleTime: 0,
    })
  }

  const error = query.isError
    ? query.error instanceof Error && query.error.message
      ? query.error.message
      : t('readers.sponsors.import.loadFailed')
    : null

  return (
    <>
      <div className="flex items-center justify-between px-5 py-2 text-xs text-neutral-500">
        <span>{t('readers.sponsors.import.github.hint')}</span>
        <Button
          aria-label={t('readers.sponsors.import.refresh')}
          disabled={query.isFetching}
          iconOnly
          onClick={refresh}
          type="button"
          variant="subtle"
        >
          <RefreshCw
            aria-hidden="true"
            className={cn('size-4', query.isFetching && 'animate-spin')}
          />
        </Button>
      </div>
      {props.children({
        entries: (query.data ?? []).map(toEntry),
        loading: !query.isSuccess && !query.isError,
        error,
        emptyText: t('readers.sponsors.import.empty'),
      })}
    </>
  )
}
