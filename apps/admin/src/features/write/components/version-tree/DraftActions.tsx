import {
  ArrowLeftRight,
  Ellipsis,
  History,
  Loader2,
  PencilLine,
  Send,
  Trash2,
} from 'lucide-react'

import { useI18n } from '~/i18n'
import type { DraftModel } from '~/models/draft'
import { DropdownMenu } from '~/ui/overlay/dropdown-menu'
import { Button } from '~/ui/primitives/button'

export interface DraftActionHandlers {
  onCompare: () => void
  onContinue: () => void
  onDelete: () => void
  onHistory: () => void
  onPublish: () => void
}

export function DraftActions(props: {
  deleting: boolean
  draft: DraftModel
  handlers: DraftActionHandlers
  labelled: boolean
}) {
  const { t } = useI18n()
  const { handlers } = props

  return (
    <>
      <Button
        aria-label={
          props.labelled ? undefined : t('write.versionTree.continue')
        }
        className="h-7 px-2 text-xs"
        onClick={handlers.onContinue}
        type="button"
        variant="ghost"
      >
        <PencilLine aria-hidden="true" className="size-3.5" />
        {props.labelled ? t('write.versionTree.continue') : null}
      </Button>
      <Button
        aria-label={props.labelled ? undefined : t('write.branch.compare')}
        className="h-7 px-2 text-xs"
        onClick={handlers.onCompare}
        type="button"
        variant="ghost"
      >
        <ArrowLeftRight aria-hidden="true" className="size-3.5" />
        {props.labelled ? t('write.branch.compare') : null}
      </Button>
      <DropdownMenu>
        <DropdownMenu.Trigger
          aria-label={t('write.versionTree.moreActions')}
          className="inline-flex size-7 items-center justify-center rounded-sm text-fg-muted transition-colors hover:bg-surface-inset hover:text-fg focus-visible:ring-[3px] focus-visible:ring-accent/15 data-[popup-open]:bg-surface-inset"
          disabled={props.deleting}
          type="button"
        >
          {props.deleting ? (
            <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
          ) : (
            <Ellipsis aria-hidden="true" className="size-4" />
          )}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end">
          <DropdownMenu.Item onClick={handlers.onHistory}>
            <History aria-hidden="true" className="size-4 text-fg-subtle" />
            {t('write.branch.history')}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            disabled={props.draft.relationToPublished === 'same'}
            onClick={handlers.onPublish}
          >
            <Send aria-hidden="true" className="size-4 text-fg-subtle" />
            {t('write.branch.publish')}
          </DropdownMenu.Item>
          <DropdownMenu.Separator />
          <DropdownMenu.Item danger onClick={handlers.onDelete}>
            <Trash2 aria-hidden="true" className="size-4" />
            {t('common.delete')}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu>
    </>
  )
}
