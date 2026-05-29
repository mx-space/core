import { Lock } from 'lucide-react'

import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'

import { presentChangePassword } from '../modals/ChangePasswordModal'
import { SettingsSection } from '../SettingsPrimitives'

export function PasswordSection() {
  const { t } = useI18n()
  return (
    <SettingsSection
      actions={
        <Button
          onClick={() => {
            void presentChangePassword()
          }}
          type="button"
          variant="subtle"
        >
          <Lock aria-hidden="true" className="size-4" />
          {t('settings.password.title')}
        </Button>
      }
      description={t('settings.password.helper')}
      title={t('settings.password.title')}
    />
  )
}
