import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import { importSponsors } from '~/api/readers'
import { useI18n } from '~/i18n'
import { ModalFooter, ModalHeader } from '~/ui/feedback/modal'
import { present, useModal } from '~/ui/feedback/modal-imperative'
import { Button } from '~/ui/primitives/button'
import { Checkbox } from '~/ui/primitives/checkbox'
import { SegmentedControl } from '~/ui/primitives/segmented-control'
import { TextInput } from '~/ui/primitives/text-field'

import { readersQueryKey } from '../../constants'
import {
  githubSponsorsQueryKey,
  GithubSponsorsSource,
} from './sponsors-import/GithubSponsorsSource'
import { SponsorEntryRow } from './sponsors-import/SponsorEntryRow'
import { SponsorsCsvSource } from './sponsors-import/SponsorsCsvSource'
import type { SponsorEntry, SponsorSourceState } from './sponsors-import/types'

type SponsorSource = 'github' | 'csv'

function parseMonths(value: string): number {
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) && n > 0 ? Math.min(n, 120) : 0
}

function SponsorsImportModal() {
  const { t } = useI18n()
  const modal = useModal<void>()
  const queryClient = useQueryClient()
  const [source, setSource] = useState<SponsorSource>('github')
  const [defaultMonths, setDefaultMonths] = useState('12')
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [unchecked, setUnchecked] = useState<Set<string>>(() => new Set())

  const monthsFor = (entry: SponsorEntry) =>
    overrides[entry.key] ??
    (entry.months !== null ? String(entry.months) : defaultMonths)
  const isChecked = (entry: SponsorEntry) => !unchecked.has(entry.key)

  const importMutation = useMutation({
    mutationFn: (grants: { readerId: string; months: number }[]) =>
      importSponsors(grants),
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
      await queryClient.invalidateQueries({ queryKey: githubSponsorsQueryKey })
      modal.close()
    },
  })

  const renderBody = (state: SponsorSourceState) => {
    const registered = state.entries.filter((e) => e.reader !== null)
    const grants = registered
      .filter(isChecked)
      .map((e) => ({
        readerId: e.reader!.id,
        months: parseMonths(monthsFor(e)),
      }))
      .filter((g) => g.months > 0)
    const allChecked = registered.length > 0 && registered.every(isChecked)

    return (
      <>
        <div className="flex items-center gap-3 border-y border-neutral-200 px-5 py-3 dark:border-neutral-800">
          <Checkbox
            checked={allChecked}
            disabled={registered.length === 0}
            label={t('readers.sponsors.import.selectAll')}
            onCheckedChange={(checked) =>
              setUnchecked(
                checked ? new Set() : new Set(registered.map((e) => e.key)),
              )
            }
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
          </div>
        </div>
        <div className="max-h-[50vh] overflow-y-auto py-1">
          {state.error ? (
            <p className="px-5 py-6 text-center text-sm text-red-500">
              {state.error}
            </p>
          ) : state.loading ? (
            <p className="px-5 py-6 text-center text-sm text-neutral-500">…</p>
          ) : state.entries.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-neutral-500">
              {state.emptyText}
            </p>
          ) : (
            state.entries.map((entry) => (
              <SponsorEntryRow
                checked={entry.reader !== null && isChecked(entry)}
                entry={entry}
                key={entry.key}
                months={monthsFor(entry)}
                onCheckedChange={(checked) =>
                  setUnchecked((prev) => {
                    const next = new Set(prev)
                    if (checked) next.delete(entry.key)
                    else next.add(entry.key)
                    return next
                  })
                }
                onMonthsChange={(value) =>
                  setOverrides((prev) => ({ ...prev, [entry.key]: value }))
                }
              />
            ))
          )}
        </div>
        <ModalFooter>
          <Button
            onClick={() => modal.dismiss()}
            type="button"
            variant="subtle"
          >
            {t('common.cancel')}
          </Button>
          <Button
            disabled={grants.length === 0 || importMutation.isPending}
            onClick={() => importMutation.mutate(grants)}
            type="button"
          >
            {t('readers.sponsors.import.submit', { count: grants.length })}
          </Button>
        </ModalFooter>
      </>
    )
  }

  return (
    <div className="flex w-full flex-col">
      <ModalHeader
        subtitle={t('readers.sponsors.import.subtitle')}
        title={t('readers.sponsors.import.title')}
      />
      <div className="px-5 pt-3">
        <SegmentedControl
          onValueChange={(value) => {
            setSource(value)
            setUnchecked(new Set())
            setOverrides({})
          }}
          options={[
            {
              label: t('readers.sponsors.import.source.github'),
              value: 'github',
            },
            { label: t('readers.sponsors.import.source.csv'), value: 'csv' },
          ]}
          value={source}
        />
      </div>
      {source === 'github' ? (
        <GithubSponsorsSource>{renderBody}</GithubSponsorsSource>
      ) : (
        <SponsorsCsvSource>{renderBody}</SponsorsCsvSource>
      )}
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
