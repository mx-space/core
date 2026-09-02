import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import type { GithubSponsorModel } from '~/api/readers'
import { getGithubSponsors, importGithubSponsors } from '~/api/readers'
import { useI18n } from '~/i18n'
import { ModalFooter, ModalHeader } from '~/ui/feedback/modal'
import { present, useModal } from '~/ui/feedback/modal-imperative'
import { Button } from '~/ui/primitives/button'
import { Checkbox } from '~/ui/primitives/checkbox'
import { TextInput } from '~/ui/primitives/text-field'
import { cn } from '~/utils/cn'

import { readersQueryKey } from '../../constants'
import { effectiveMembershipStatus } from '../../utils/membership-status'

const sponsorsQueryKey = ['readers', 'github-sponsors'] as const

function parseMonths(value: string): number {
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) && n > 0 ? Math.min(n, 120) : 0
}

function SponsorRow(props: {
  sponsor: GithubSponsorModel
  checked: boolean
  months: string
  onCheckedChange: (checked: boolean) => void
  onMonthsChange: (value: string) => void
}) {
  const { t } = useI18n()
  const { sponsor } = props
  const reader = sponsor.reader
  const membershipStatus = reader
    ? effectiveMembershipStatus(reader.membership)
    : null

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-5 py-2 text-sm',
        !reader && 'opacity-50',
      )}
    >
      <Checkbox
        checked={props.checked}
        disabled={!reader}
        onCheckedChange={props.onCheckedChange}
      />
      <img
        alt=""
        className="size-7 shrink-0 rounded-full"
        src={sponsor.avatarUrl}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-fg">{sponsor.login}</span>
          <span
            className={cn(
              'shrink-0 rounded-sm px-1.5 py-0.5 text-[10px]',
              sponsor.isActive
                ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                : 'bg-neutral-500/10 text-neutral-500',
            )}
          >
            {t(
              sponsor.isActive
                ? 'readers.sponsors.import.active'
                : 'readers.sponsors.import.past',
            )}
          </span>
        </div>
        <div className="truncate text-xs text-neutral-500 dark:text-neutral-400">
          {sponsor.tierName ?? '—'}
          {' · '}
          {reader
            ? `${reader.name ?? reader.handle ?? reader.id}${
                membershipStatus && membershipStatus !== 'none'
                  ? ` (${membershipStatus})`
                  : ''
              }`
            : t('readers.sponsors.import.unregistered')}
        </div>
      </div>
      {reader ? (
        <div className="flex shrink-0 items-center gap-1">
          <TextInput
            controlClassName="w-16 text-right tabular-nums"
            inputMode="numeric"
            min={1}
            onChange={props.onMonthsChange}
            type="number"
            value={props.months}
          />
          <span className="text-xs text-neutral-500">
            {t('readers.sponsors.import.months')}
          </span>
        </div>
      ) : null}
    </div>
  )
}

function SponsorsImportModal() {
  const { t } = useI18n()
  const modal = useModal<void>()
  const queryClient = useQueryClient()
  const [defaultMonths, setDefaultMonths] = useState('12')
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [unchecked, setUnchecked] = useState<Set<string>>(() => new Set())

  const sponsorsQuery = useQuery({
    queryFn: () => getGithubSponsors(),
    queryKey: sponsorsQueryKey,
  })

  const sponsors = sponsorsQuery.data ?? []
  const registered = useMemo(
    () => sponsors.filter((s) => s.reader !== null),
    [sponsors],
  )

  const monthsFor = (id: string) => overrides[id] ?? defaultMonths
  const isChecked = (id: string) => !unchecked.has(id)

  const grants = registered
    .filter((s) => isChecked(s.githubId))
    .map((s) => ({
      readerId: s.reader!.id,
      months: parseMonths(monthsFor(s.githubId)),
    }))
    .filter((g) => g.months > 0)

  const importMutation = useMutation({
    mutationFn: () => importGithubSponsors(grants),
    onError: (error) =>
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t('readers.toast.sponsorsImportFailed'),
      ),
    onSuccess: async (result) => {
      toast.success(
        t('readers.toast.sponsorsImported', {
          granted: result.granted,
          skipped: result.skipped.length,
        }),
      )
      await queryClient.invalidateQueries({ queryKey: readersQueryKey })
      await queryClient.invalidateQueries({ queryKey: sponsorsQueryKey })
      modal.close()
    },
  })

  const refresh = async () => {
    await queryClient.fetchQuery({
      queryFn: () => getGithubSponsors(true),
      queryKey: sponsorsQueryKey,
      staleTime: 0,
    })
  }

  const toggleAll = (checked: boolean) => {
    setUnchecked(
      checked ? new Set() : new Set(registered.map((s) => s.githubId)),
    )
  }

  const allChecked =
    registered.length > 0 && registered.every((s) => isChecked(s.githubId))

  return (
    <div className="flex w-full flex-col">
      <ModalHeader
        subtitle={t('readers.sponsors.import.subtitle')}
        title={t('readers.sponsors.import.title')}
      />
      <div className="flex items-center gap-3 border-b border-neutral-200 px-5 py-3 dark:border-neutral-800">
        <Checkbox
          checked={allChecked}
          disabled={registered.length === 0}
          label={t('readers.sponsors.import.selectAll')}
          onCheckedChange={toggleAll}
        />
        <div className="ml-auto flex items-center gap-2 text-sm">
          <span className="text-neutral-500">
            {t('readers.sponsors.import.defaultMonths')}
          </span>
          <TextInput
            controlClassName="w-16 text-right tabular-nums"
            inputMode="numeric"
            min={1}
            onChange={(v) => {
              setDefaultMonths(v)
              setOverrides({})
            }}
            type="number"
            value={defaultMonths}
          />
          <Button
            aria-label={t('readers.sponsors.import.refresh')}
            disabled={sponsorsQuery.isFetching}
            iconOnly
            onClick={refresh}
            type="button"
            variant="subtle"
          >
            <RefreshCw
              aria-hidden="true"
              className={cn(
                'size-4',
                sponsorsQuery.isFetching && 'animate-spin',
              )}
            />
          </Button>
        </div>
      </div>
      <div className="max-h-[60vh] overflow-y-auto py-1">
        {sponsorsQuery.isError ? (
          <p className="px-5 py-6 text-center text-sm text-red-500">
            {sponsorsQuery.error instanceof Error && sponsorsQuery.error.message
              ? sponsorsQuery.error.message
              : t('readers.sponsors.import.loadFailed')}
          </p>
        ) : !sponsorsQuery.isSuccess ? (
          <p className="px-5 py-6 text-center text-sm text-neutral-500">…</p>
        ) : sponsors.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-neutral-500">
            {t('readers.sponsors.import.empty')}
          </p>
        ) : (
          sponsors.map((sponsor) => (
            <SponsorRow
              checked={sponsor.reader !== null && isChecked(sponsor.githubId)}
              key={sponsor.githubId}
              months={monthsFor(sponsor.githubId)}
              onCheckedChange={(checked) =>
                setUnchecked((prev) => {
                  const next = new Set(prev)
                  if (checked) next.delete(sponsor.githubId)
                  else next.add(sponsor.githubId)
                  return next
                })
              }
              onMonthsChange={(value) =>
                setOverrides((prev) => ({ ...prev, [sponsor.githubId]: value }))
              }
              sponsor={sponsor}
            />
          ))
        )}
      </div>
      <ModalFooter>
        <Button onClick={() => modal.dismiss()} type="button" variant="subtle">
          {t('common.cancel')}
        </Button>
        <Button
          disabled={grants.length === 0 || importMutation.isPending}
          onClick={() => importMutation.mutate()}
          type="button"
        >
          {t('readers.sponsors.import.submit', { count: grants.length })}
        </Button>
      </ModalFooter>
    </div>
  )
}

export function presentSponsorsImportModal() {
  return present<Record<string, never>, void>(
    SponsorsImportModal,
    {},
    { modalProps: { popupStyle: { width: 'min(92vw, 36rem)' } } },
  )
}
