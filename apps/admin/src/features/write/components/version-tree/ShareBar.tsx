import { Copy, Ellipsis, Link2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { WEB_URL } from '~/constants/env'
import { useI18n } from '~/i18n'
import type { DraftShare } from '~/models/draft'
import { DropdownMenu } from '~/ui/overlay/dropdown-menu'
import { Button } from '~/ui/primitives/button'

export const shareUrlOf = (token: string) => `${WEB_URL}/preview/${token}`

export function ShareBar(props: {
  canFollowCurrentDraft: boolean
  onCreate: () => void
  onFollowCurrentDraft: () => void
  onRevoke: () => void
  pending: boolean
  share: DraftShare | null
}) {
  const { t } = useI18n()

  if (!props.share) {
    return (
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-xs text-fg-muted">
          {t('write.share.description')}
        </span>
        <Button
          className="h-7 shrink-0 px-2 text-xs"
          disabled={props.pending}
          onClick={props.onCreate}
          type="button"
          variant="ghost"
        >
          {props.pending ? (
            <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
          ) : (
            <Link2 aria-hidden="true" className="size-3.5" />
          )}
          {t('write.share.create')}
        </Button>
      </div>
    )
  }

  const url = shareUrlOf(props.share.token)
  const following = props.share.mode === 'follow'

  return (
    <div className="flex flex-col gap-1.5 border-b border-border bg-accent-soft px-3 py-2">
      <div className="flex items-center gap-2">
        <Link2 aria-hidden="true" className="size-3.5 shrink-0 text-accent" />
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-fg">
          {url}
        </span>
        <Button
          aria-label={t('write.share.copy')}
          className="size-7 shrink-0 p-0"
          onClick={() => {
            void navigator.clipboard.writeText(url)
            toast.success(t('write.share.copied'))
          }}
          type="button"
          variant="ghost"
        >
          <Copy aria-hidden="true" className="size-3.5" />
        </Button>
        <DropdownMenu>
          <DropdownMenu.Trigger
            aria-label={t('write.share.moreActions')}
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-sm text-fg-muted transition-colors hover:bg-surface-inset hover:text-fg focus-visible:ring-[3px] focus-visible:ring-accent/15 data-[popup-open]:bg-surface-inset"
            disabled={props.pending}
            type="button"
          >
            {props.pending ? (
              <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
            ) : (
              <Ellipsis aria-hidden="true" className="size-4" />
            )}
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="end">
            <DropdownMenu.Item
              disabled={!props.canFollowCurrentDraft || following}
              onClick={props.onFollowCurrentDraft}
            >
              <Link2 aria-hidden="true" className="size-4 text-fg-subtle" />
              {t('write.share.followCurrent')}
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Item danger onClick={props.onRevoke}>
              {t('write.share.revoke')}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={
            following
              ? 'shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300'
              : 'shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400'
          }
        >
          {following
            ? t('write.share.modeFollow')
            : t('write.share.modePinned')}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs text-fg-muted">
          {following
            ? t('write.share.modeFollowHint')
            : t('write.share.modePinnedHint')}
        </span>
      </div>
    </div>
  )
}
