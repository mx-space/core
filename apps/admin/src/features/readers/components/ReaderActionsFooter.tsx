import { Ban, ShieldCheck, UserMinus, UserStar } from 'lucide-react'
import type { ReaderModel } from '~/api/readers'
import type { useReaderMutations } from '../hooks/useReaderMutations'

import { useI18n } from '~/i18n'
import { confirmDialog } from '~/ui/feedback/confirm'
import { Button } from '~/ui/primitives/button'

import { presentBanReaderModal } from './modals/BanReaderModal'

export function ReaderActionsFooter(props: {
  reader: ReaderModel
  currentUserId: string | null
  mutations: ReturnType<typeof useReaderMutations>
}) {
  const { t } = useI18n()
  const { reader, mutations } = props
  const name = reader.name ?? reader.handle ?? reader.id

  const isSelf =
    props.currentUserId != null && props.currentUserId === reader.id
  const isOwner = reader.role === 'owner'
  const banned = Boolean(reader.bannedAt)

  const banDisabledReason = isOwner
    ? t('readers.action.cannotBanOwner')
    : isSelf
      ? t('readers.action.cannotBanSelf')
      : undefined
  const transferDisabled = isOwner || isSelf

  const handleTransfer = async () => {
    const ok = await confirmDialog({
      description: t('readers.transferOwner.desc', { name }),
      destructive: false,
      title: t('readers.transferOwner.title'),
    })
    if (ok) mutations.transferOwner.mutate(reader.id)
  }

  const handleRevoke = async () => {
    const ok = await confirmDialog({
      description: t('readers.revokeOwner.desc', { name }),
      destructive: true,
      title: t('readers.revokeOwner.title'),
    })
    if (ok) mutations.revokeOwner.mutate(reader.id)
  }

  const handleBan = async () => {
    const reason = await presentBanReaderModal(reader)
    if (reason === undefined) return
    mutations.banReader.mutate({ id: reader.id, reason: reason || undefined })
  }

  const handleUnban = () => mutations.unbanReader.mutate(reader.id)

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
      <Button
        className="h-9 px-3"
        disabled={transferDisabled || mutations.transferOwner.isPending}
        onClick={handleTransfer}
        type="button"
        variant="subtle"
      >
        <UserStar aria-hidden="true" className="size-4" />
        {t('readers.action.transferOwner')}
      </Button>

      {isOwner ? (
        <Button
          className="h-9 px-3"
          disabled={mutations.revokeOwner.isPending}
          onClick={handleRevoke}
          type="button"
          variant="subtle"
        >
          <UserMinus aria-hidden="true" className="size-4" />
          {t('readers.action.revokeOwner')}
        </Button>
      ) : null}

      <div className="flex-1" />

      {banned ? (
        <Button
          className="h-9 px-3"
          disabled={mutations.unbanReader.isPending}
          onClick={handleUnban}
          type="button"
          variant="subtle"
        >
          <ShieldCheck aria-hidden="true" className="size-4" />
          {t('readers.action.unban')}
        </Button>
      ) : (
        <Button
          className="h-9 border-red-200 px-3 text-red-600 hover:bg-red-50 disabled:hover:bg-transparent dark:border-red-950 dark:text-red-400 dark:hover:bg-red-950/30"
          disabled={Boolean(banDisabledReason) || mutations.banReader.isPending}
          onClick={handleBan}
          title={banDisabledReason}
          type="button"
          variant="subtle"
        >
          <Ban aria-hidden="true" className="size-4" />
          {t('readers.action.ban')}
        </Button>
      )}
    </div>
  )
}
