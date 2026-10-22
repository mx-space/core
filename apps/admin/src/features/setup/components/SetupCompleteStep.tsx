import { ChevronLeft, PartyPopper } from 'lucide-react'

import { useI18n } from '~/i18n'
import { showConfetti } from '~/utils/confetti'

import {
  iconTileClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from '../constants'

export function SetupCompleteStep(props: { onPrev: () => void }) {
  const { t } = useI18n()
  const complete = () => {
    localStorage.setItem('to-setting', 'true')
    showConfetti()
    setTimeout(() => {
      location.reload()
    }, 200)
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className={iconTileClassName}>
        <PartyPopper aria-hidden="true" className="size-12" />
      </div>

      <p className="mb-4 text-center text-sm text-fg-muted">
        {t('setup.complete.description')}
      </p>

      <div className="flex gap-3">
        <button
          className={secondaryButtonClassName}
          onClick={props.onPrev}
          type="button"
        >
          <ChevronLeft aria-hidden="true" className="mr-1 size-4" />
          {t('common.back')}
        </button>
        <button
          className={primaryButtonClassName}
          onClick={complete}
          type="button"
        >
          {t('setup.complete.submit')}
        </button>
      </div>
    </div>
  )
}
