import { ImageIcon } from 'lucide-react'
import { useMemo } from 'react'

import { useI18n } from '~/i18n'

export function ProjectImageGrid(props: { images: string[] }) {
  const { t } = useI18n()
  return (
    <section className="border-t border-neutral-100 pt-5 dark:border-neutral-800">
      <h4 className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
        <ImageIcon aria-hidden="true" className="size-4" />
        {t('projects.detail.imagesTitle')}
      </h4>
      <div className="grid grid-cols-2 gap-2">
        {props.images.map((image, index) => (
          <a
            className="group block overflow-hidden rounded bg-neutral-100 dark:bg-neutral-900"
            href={image}
            key={`${image}-${index}`}
            rel="noreferrer"
            target="_blank"
          >
            <img
              alt={t('projects.detail.imageAlt', { index: index + 1 })}
              className="h-32 w-full object-cover transition-transform group-hover:scale-105"
              loading="lazy"
              src={image}
            />
          </a>
        ))}
      </div>
    </section>
  )
}

export function ImagePreview(props: { imagesText: string }) {
  const images = useMemo(
    () =>
      props.imagesText
        .split('\n')
        .map((image) => image.trim())
        .filter(Boolean),
    [props.imagesText],
  )

  if (images.length === 0) return null

  return <ProjectImageGrid images={images} />
}
