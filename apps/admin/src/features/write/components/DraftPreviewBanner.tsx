import { Eye } from 'lucide-react'

import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'

interface DraftPreviewBannerProps {
  draftLabel: string
  onApply: () => void
  onCancel: () => void
}

export function DraftPreviewBanner(props: DraftPreviewBannerProps) {
  const { t } = useI18n()

  return (
    <div
      className="flex items-center gap-3 rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 text-accent"
      role="status"
    >
      <Eye aria-hidden="true" className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-sm">
        {props.draftLabel}
      </span>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          className="h-7 px-2.5 text-xs"
          onClick={props.onApply}
          type="button"
          variant="primary"
        >
          {t('write.preview.banner.apply')}
        </Button>
        <Button
          className="h-7 px-2.5 text-xs"
          onClick={props.onCancel}
          type="button"
          variant="ghost"
        >
          {t('write.preview.banner.cancel')}
        </Button>
      </div>
    </div>
  )
}
