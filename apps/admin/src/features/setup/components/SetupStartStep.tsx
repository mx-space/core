import { useRef, useState } from 'react'
import { toast } from 'sonner'

import { restoreFromBackup } from '~/api/system'
import { useI18n } from '~/i18n'
import { authDescriptionClassName } from '~/lib/auth-backdrop'
import { Button } from '~/ui/primitives/button'

import { getErrorMessage } from '../utils/setup'

export function SetupStartStep(props: { onNext: () => void }) {
  const { t } = useI18n()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [restoring, setRestoring] = useState(false)

  const restore = async (file: File | undefined) => {
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)
    setRestoring(true)

    try {
      await restoreFromBackup(formData)
      toast.success(t('setup.start.restoreSuccess'))
      setTimeout(() => {
        location.reload()
      }, 1000)
    } catch (error) {
      toast.error(getErrorMessage(error, t('setup.start.restoreError')))
    } finally {
      setRestoring(false)
    }
  }

  return (
    <div>
      <p className={authDescriptionClassName}>{t('setup.start.description')}</p>

      <div className="mt-6 flex justify-end gap-2">
        <Button
          disabled={restoring}
          onClick={() => fileInputRef.current?.click()}
          type="button"
          variant="secondary"
        >
          {t('setup.start.restoreButton')}
        </Button>
        <Button onClick={props.onNext} type="button">
          {t('setup.start.beginButton')}
        </Button>
        <input
          accept=".zip"
          className="hidden"
          onChange={(event) => {
            void restore(event.target.files?.[0])
          }}
          ref={fileInputRef}
          type="file"
        />
      </div>
    </div>
  )
}
