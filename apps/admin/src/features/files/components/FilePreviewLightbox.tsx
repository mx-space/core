import { Dialog } from '@base-ui/react/dialog'
import { ExternalLink } from 'lucide-react'

import { useI18n } from '~/i18n'

interface FilePreviewLightboxProps {
  image: null | { name: string; url: string }
  onClose: () => void
}

export function FilePreviewLightbox(props: FilePreviewLightboxProps) {
  const { t } = useI18n()
  return (
    <Dialog.Root
      onOpenChange={(open) => {
        if (!open) props.onClose()
      }}
      open={Boolean(props.image)}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/70" />
        <Dialog.Popup className="outline-hidden fixed inset-4 z-50 flex flex-col overflow-hidden rounded border border-neutral-800 bg-neutral-950 shadow-2xl sm:inset-8">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <Dialog.Title className="min-w-0 truncate text-sm font-medium text-white">
              {props.image?.name ?? t('files.preview.title')}
            </Dialog.Title>
            <div className="flex shrink-0 items-center gap-2">
              {props.image ? (
                <a
                  className="inline-flex h-8 items-center gap-2 rounded border border-white/15 px-2.5 text-xs text-neutral-200 transition-colors hover:bg-white/10"
                  href={props.image.url}
                  rel="noreferrer"
                  target="_blank"
                >
                  <ExternalLink aria-hidden="true" className="size-3.5" />
                  {t('files.action.open')}
                </a>
              ) : null}
              <Dialog.Close className="inline-flex h-8 items-center rounded border border-white/15 px-2.5 text-xs text-neutral-200 transition-colors hover:bg-white/10">
                {t('files.action.close')}
              </Dialog.Close>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center bg-black p-3">
            {props.image ? (
              <img
                alt={props.image.name}
                className="max-h-full max-w-full object-contain"
                src={props.image.url}
              />
            ) : null}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
