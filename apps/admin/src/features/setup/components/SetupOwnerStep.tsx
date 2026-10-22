import type { FormEvent } from 'react'
import { useState } from 'react'
import { toast } from 'sonner'

import type { CreateOwnerData } from '~/api/system'
import { createOwner } from '~/api/system'
import { useI18n } from '~/i18n'
import { TextInput } from '~/ui/primitives/text-field'

import { getErrorMessage, removeEmptyStrings } from '../utils/setup'
import { StepActions, UrlInput } from './SetupPrimitives'

export function SetupOwnerStep(props: {
  onNext: () => void
  onPrev: () => void
}) {
  const { t } = useI18n()
  const [owner, setOwner] = useState<CreateOwnerData>({
    mail: '',
    password: '',
    username: '',
  })
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const canSubmit = Boolean(
    owner.username && owner.mail && owner.password && confirmPassword,
  )

  const updateOwner = (patch: Partial<CreateOwnerData>) => {
    setOwner((current) => ({ ...current, ...patch }))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!canSubmit || submitting) return

    if (confirmPassword !== owner.password) {
      toast.error(t('setup.owner.passwordMismatch'))
      return
    }

    setSubmitting(true)

    try {
      await createOwner(removeEmptyStrings(owner))
      props.onNext()
    } catch (error) {
      toast.error(getErrorMessage(error, t('setup.owner.createError')))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="space-y-4">
        <TextInput
          autoComplete="username"
          label={t('setup.owner.usernameLabel')}
          onChange={(value) => updateOwner({ username: value })}
          placeholder={t('setup.owner.usernamePlaceholder')}
          required
          value={owner.username}
        />

        <TextInput
          autoComplete="name"
          label={t('setup.owner.nicknameLabel')}
          onChange={(value) => updateOwner({ name: value })}
          placeholder={t('setup.owner.nicknamePlaceholder')}
          value={owner.name ?? ''}
        />

        <TextInput
          autoComplete="email"
          label={t('setup.owner.emailLabel')}
          onChange={(value) => updateOwner({ mail: value })}
          placeholder={t('setup.owner.emailPlaceholder')}
          required
          type="email"
          value={owner.mail}
        />

        <div className="grid grid-cols-2 gap-3">
          <TextInput
            autoComplete="new-password"
            label={t('setup.owner.passwordLabel')}
            onChange={(value) => updateOwner({ password: value })}
            placeholder={t('setup.owner.passwordPlaceholder')}
            required
            type="password"
            value={owner.password}
          />

          <TextInput
            autoComplete="new-password"
            label={t('setup.owner.confirmPasswordLabel')}
            onChange={setConfirmPassword}
            placeholder={t('setup.owner.confirmPasswordPlaceholder')}
            required
            type="password"
            value={confirmPassword}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <UrlInput
            label={t('setup.owner.homepageLabel')}
            onChange={(value) => updateOwner({ url: value })}
            placeholder="https://"
            value={owner.url ?? ''}
          />
          <UrlInput
            label={t('setup.owner.avatarLabel')}
            onChange={(value) => updateOwner({ avatar: value })}
            placeholder="https://"
            value={owner.avatar ?? ''}
          />
        </div>

        <TextInput
          autoComplete="off"
          label={t('setup.owner.introduceLabel')}
          onChange={(value) => updateOwner({ introduce: value })}
          placeholder={t('setup.owner.introducePlaceholder')}
          value={owner.introduce ?? ''}
        />
      </div>

      <StepActions
        canSubmit={canSubmit}
        onPrev={props.onPrev}
        submitting={submitting}
      />
    </form>
  )
}
