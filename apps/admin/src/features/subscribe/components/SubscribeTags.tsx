import { useI18n } from '~/i18n'

import { subscribeBits } from '../constants'

export function SubscribeTags(props: { subscribe: number }) {
  const { t } = useI18n()
  const tags = subscribeBits.filter(({ bit }) => bit & props.subscribe)

  if (tags.length === 0) {
    return (
      <span className="text-xs text-neutral-400">
        {t('subscribe.tags.none')}
      </span>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      {tags.map((tag) => (
        <span
          className={`rounded px-1.5 py-0.5 text-xs font-medium ${tag.className}`}
          key={tag.bit}
        >
          {t(tag.labelKey)}
        </span>
      ))}
    </div>
  )
}
