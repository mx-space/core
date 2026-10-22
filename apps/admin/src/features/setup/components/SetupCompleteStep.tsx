import { ChevronLeft, PartyPopper } from 'lucide-react'

import { useI18n } from '~/i18n'
import { authDescriptionClassName } from '~/lib/auth-backdrop'
import { Button } from '~/ui/primitives/button'
import { showConfetti } from '~/utils/confetti'

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
    <div>
      <p className={authDescriptionClassName}>
        {t('setup.complete.description')}
      </p>

      <div className="mt-6 flex justify-between">
        <Button onClick={props.onPrev} type="button" variant="secondary">
          <ChevronLeft aria-hidden="true" className="size-4" />
          {t('common.back')}
        </Button>
        <Button onClick={complete} type="button">
          <PartyPopper aria-hidden="true" className="size-4" />
          {t('setup.complete.submit')}
        </Button>
      </div>
    </div>
  )
}
