import { ChevronLeft, PartyPopper } from 'lucide-react'

import { useI18n } from '~/i18n'
import { showConfetti } from '~/utils/confetti'

import { primaryButtonClassName, secondaryButtonClassName } from '../constants'

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
      <div className="mb-4 flex size-24 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-md">
        <PartyPopper aria-hidden="true" className="size-12" />
      </div>

      <p className="mb-4 text-center text-sm text-white/80">
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
