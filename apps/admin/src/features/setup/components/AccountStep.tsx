import { useQueryClient } from '@tanstack/react-query'
import { Fingerprint, ImagePlus, Link2 } from 'lucide-react'
import type { FormEvent, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { uploadFile } from '~/api/files'
import { getOwner, updateOwner } from '~/api/options'
import { createOwner } from '~/api/system'
import { SESSION_WITH_LOGIN } from '~/constants/keys'
import { loggedStatusQueryKey } from '~/features/auth/constants'
import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { TextInput } from '~/ui/primitives/text-field'
import { authClient } from '~/utils/authjs/auth'

import { getErrorMessage } from '../utils/setup'
import {
  FieldHint,
  OnboardingAsideTitle,
  OnboardingCard,
  OnboardingFooter,
  OnboardingShell,
} from './OnboardingShell'

const minPasswordLength = 8

export function AccountStep(props: {
  onBack: () => void
  onCreated: (ownerId: string) => void
}) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [username, setUsername] = useState('')
  const [mail, setMail] = useState('')
  const [password, setPassword] = useState('')
  const [avatar, setAvatar] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!avatar) return
    const url = URL.createObjectURL(avatar)
    setAvatarPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [avatar])

  const canSubmit =
    username.trim() !== '' &&
    mail.trim() !== '' &&
    password.length >= minPasswordLength

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!canSubmit || submitting) return
    setSubmitting(true)
    const name = username.trim()

    try {
      await createOwner({ mail: mail.trim(), name, password, username: name })
    } catch (error) {
      toast.error(
        getErrorMessage(error, t('setup.onboarding.account.createError')),
      )
      setSubmitting(false)
      return
    }

    try {
      const result = await authClient.signIn.username({
        password,
        username: name,
      })
      if (result.error) throw new Error(result.error.message)
      sessionStorage.setItem(SESSION_WITH_LOGIN, '1')
      queryClient.removeQueries({ queryKey: loggedStatusQueryKey })

      if (avatar) {
        try {
          const uploaded = await uploadFile(avatar, 'avatar')
          await updateOwner({ avatar: uploaded.url })
        } catch (error) {
          toast.error(
            getErrorMessage(error, t('setup.onboarding.account.avatarError')),
          )
        }
      }

      const owner = await getOwner()
      props.onCreated(owner.id)
    } catch {
      toast.error(t('setup.onboarding.account.signInError'))
      location.hash = '/login'
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <OnboardingShell
      aside={
        <>
          <OnboardingAsideTitle>
            {t('setup.onboarding.account.asideTitle')}
          </OnboardingAsideTitle>
          <div className="flex flex-col gap-3 text-sm">
            <AsideOption
              description={t('setup.onboarding.account.asidePasskey')}
              icon={<Fingerprint className="size-3.5" />}
              title="Passkey"
            />
            <AsideOption
              description={t('setup.onboarding.account.asideSocial')}
              icon={<Link2 className="size-3.5" />}
              title="GitHub / Google"
            />
          </div>
        </>
      }
      step="account"
    >
      <form className="contents" onSubmit={submit}>
        <OnboardingCard
          description={t('setup.onboarding.account.description')}
          footer={
            <OnboardingFooter onBack={props.onBack}>
              <Button
                data-testid="onboarding-submit"
                disabled={!canSubmit || submitting}
                type="submit"
              >
                {t('setup.onboarding.account.submit')}
              </Button>
            </OnboardingFooter>
          }
          title={t('setup.onboarding.account.title')}
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <button
                aria-label={t('setup.onboarding.account.avatarUpload')}
                className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-dashed border-border-strong bg-surface-page text-fg-muted transition-colors hover:bg-surface-inset"
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                {avatarPreview ? (
                  <img
                    alt=""
                    className="size-full object-cover"
                    src={avatarPreview}
                  />
                ) : (
                  <ImagePlus aria-hidden="true" className="size-4" />
                )}
              </button>
              <span className="text-sm text-fg-muted">
                {t('setup.onboarding.account.avatar')}
              </span>
              <input
                accept="image/*"
                className="hidden"
                onChange={(event) => setAvatar(event.target.files?.[0] ?? null)}
                ref={fileInputRef}
                type="file"
              />
            </div>
            <TextInput
              autoComplete="username"
              autoFocus
              label={t('setup.onboarding.account.username')}
              name="username"
              onChange={setUsername}
              required
              value={username}
            />
            <div>
              <TextInput
                autoComplete="email"
                label={t('setup.onboarding.account.email')}
                name="mail"
                onChange={setMail}
                required
                type="email"
                value={mail}
              />
              <FieldHint>{t('setup.onboarding.account.emailHint')}</FieldHint>
            </div>
            <div>
              <TextInput
                autoComplete="new-password"
                label={t('setup.onboarding.account.password')}
                name="password"
                onChange={setPassword}
                required
                type="password"
                value={password}
              />
              <FieldHint>
                {t('setup.onboarding.account.passwordHint')}
              </FieldHint>
            </div>
          </div>
        </OnboardingCard>
      </form>
    </OnboardingShell>
  )
}

function AsideOption(props: {
  description: string
  icon: ReactNode
  title: string
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-accent-soft text-accent">
        {props.icon}
      </span>
      <span>
        <span className="block font-medium text-fg">{props.title}</span>
        <span className="text-fg-muted">{props.description}</span>
      </span>
    </div>
  )
}
