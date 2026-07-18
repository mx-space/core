import type { ReaderModel } from '~/api/readers'
import { useI18n } from '~/i18n'
import { StatusPill } from '~/ui/data/StatusPill'
import { confirmDialog } from '~/ui/feedback/confirm'
import { Button } from '~/ui/primitives/button'
import { parseDate } from '~/utils/time'

import type { useReaderMutations } from '../hooks/useReaderMutations'
import {
  effectiveMembershipStatus,
  hasLiveProviderManagedMembership,
  MEMBERSHIP_PLAN_LABEL_KEY,
  MEMBERSHIP_STATUS_LABEL_KEY,
  MEMBERSHIP_STATUS_TONE,
  providerLabel,
} from '../utils/membership-status'
import { presentMembershipGrantModal } from './modals/MembershipGrantModal'

export function ReaderMembershipBlock(props: {
  reader: ReaderModel
  mutations: ReturnType<typeof useReaderMutations>
}) {
  const { t } = useI18n()
  const { reader, mutations } = props
  const membership = reader.membership ?? null
  const status = effectiveMembershipStatus(membership)
  const liveProviderManaged = hasLiveProviderManagedMembership(membership)
  const isManual = membership?.provider === 'manual'
  const name = reader.name ?? reader.handle ?? reader.id

  const handleGrant = async () => {
    const result = await presentMembershipGrantModal(reader)
    if (!result) return
    mutations.grantMembership.mutate({ readerId: reader.id, ...result })
  }

  const handleRevoke = async () => {
    const ok = await confirmDialog({
      description: t('readers.membership.revoke.desc', { name }),
      destructive: true,
      title: t('readers.membership.revoke.title'),
    })
    if (ok) mutations.revokeMembership.mutate(reader.id)
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {t('readers.membership.section.title')}
      </h3>

      <div className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
        <div className="flex items-center justify-between gap-2">
          <StatusPill tone={MEMBERSHIP_STATUS_TONE[status]}>
            {t(MEMBERSHIP_STATUS_LABEL_KEY[status])}
          </StatusPill>
          {membership ? (
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              {t(MEMBERSHIP_PLAN_LABEL_KEY[membership.plan])} ·{' '}
              {providerLabel(membership.provider)}
            </span>
          ) : null}
        </div>

        {membership ? (
          <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            {t('readers.membership.periodEnd', {
              date: parseDate(
                membership.currentPeriodEnd,
                'yyyy 年 M 月 d 日 HH:mm:ss',
              ),
            })}
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!liveProviderManaged ? (
            <Button
              className="h-8 px-3"
              disabled={mutations.grantMembership.isPending}
              onClick={handleGrant}
              type="button"
              variant="subtle"
            >
              {t(
                membership
                  ? 'readers.membership.action.extend'
                  : 'readers.membership.action.grant',
              )}
            </Button>
          ) : null}
          {isManual ? (
            <Button
              className="h-8 border-red-200 px-3 text-red-600 hover:bg-red-50 disabled:hover:bg-transparent dark:border-red-950 dark:text-red-400 dark:hover:bg-red-950/30"
              disabled={mutations.revokeMembership.isPending}
              onClick={handleRevoke}
              type="button"
              variant="subtle"
            >
              {t('readers.membership.action.revoke')}
            </Button>
          ) : null}
          {liveProviderManaged ? (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {t('readers.membership.providerManagedHint')}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  )
}
