import { ExternalLink } from 'lucide-react'

import { useI18n } from '~/i18n'
import {
  Lightbox,
  lightboxButtonClass,
  LightboxClose,
} from '~/ui/overlay/lightbox'

interface FilePreviewLightboxProps {
  image: null | { name: string; url: string }
  onClose: () => void
}

export function FilePreviewLightbox(props: FilePreviewLightboxProps) {
  const { t } = useI18n()
  const open = Boolean(props.image)
  return (
    <Lightbox
      actions={
        <>
          {props.image ? (
            <a
              className={lightboxButtonClass}
              href={props.image.url}
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink aria-hidden="true" className="size-3.5" />
              {t('files.action.open')}
            </a>
          ) : null}
          <LightboxClose className={lightboxButtonClass}>
            {t('files.action.close')}
          </LightboxClose>
        </>
      }
      onOpenChange={(value) => {
        if (!value) props.onClose()
      }}
      open={open}
      title={props.image?.name ?? t('files.preview.title')}
    >
      {props.image ? (
        <img
          alt={props.image.name}
          className="max-h-full max-w-full object-contain"
          src={props.image.url}
        />
      ) : null}
    </Lightbox>
  )
}
