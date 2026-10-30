import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  Eye,
  EyeOff,
  Fingerprint,
  Loader2,
  ShieldCheck,
} from 'lucide-react'
import type { FormEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { getJson } from '~/api/http'
import { SESSION_WITH_LOGIN } from '~/constants/keys'
import { useI18n } from '~/i18n'
import type { UserModel } from '~/models/user'
import { Button } from '~/ui/primitives/button'
import { TextInput } from '~/ui/primitives/text-field'
import { authClient } from '~/utils/authjs/auth'

import {
  allowLoginQueryKey,
  initQueryKey,
  loggedStatusQueryKey,
  ownerQueryKey,
} from '../constants'
import { AuthScene } from '../entry/AuthExperience'
import type { AllowLoginResponse } from '../types/login'
import { checkIsInit } from '../utils/check-init'
import { readErrorMessage, readInitial } from '../utils/login'
import { AppleIcon } from './AppleIcon'
import { GithubIcon } from './GithubIcon'
import { GoogleIcon } from './GoogleIcon'

export function LoginRouteViewContent() {
  const { t } = useI18n()
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [passkeyAttempted, setPasskeyAttempted] = useState(false)

  const initQuery = useQuery({
    queryFn: checkIsInit,
    queryKey: initQueryKey,
    retry: false,
  })
  const ownerQuery = useQuery({
    enabled: initQuery.data !== false,
    queryFn: () => getJson<UserModel>('/owner'),
    queryKey: ownerQueryKey,
    retry: false,
  })
  const allowLoginQuery = useQuery({
    enabled: initQuery.data !== false,
    queryFn: () => getJson<AllowLoginResponse>('/owner/allow-login'),
    queryKey: allowLoginQueryKey,
    retry: false,
  })

  const owner = ownerQuery.data
  const settings = allowLoginQuery.data
  const fromPath = searchParams.get('from') || '/dashboard'
  const showPasswordInput = settings?.password !== false
  const hasAlternativeAuth =
    Boolean(settings?.passkey) ||
    Boolean(settings?.github) ||
    Boolean(settings?.google) ||
    Boolean(settings?.apple)

  const callbackURL = useMemo(() => {
    const callbackPath = searchParams.get('to') || fromPath
    return `${window.location.origin}${window.location.pathname}#${callbackPath}`
  }, [fromPath, searchParams])

  useEffect(() => {
    if (initQuery.data === false) {
      navigate('/setup', { replace: true })
    }
  }, [initQuery.data, navigate])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (passkeyAttempted || settings?.password !== false) return

    setPasskeyAttempted(true)
    void handlePasskeyLogin()
  }, [passkeyAttempted, settings?.password])

  const postSuccessfulLogin = () => {
    sessionStorage.setItem(SESSION_WITH_LOGIN, '1')
    queryClient.removeQueries({ queryKey: loggedStatusQueryKey })
    toast.success(t('auth.login.welcomeBack'))
    navigate(fromPath, { replace: true })
  }

  const handlePasswordLogin = async (event: FormEvent) => {
    event.preventDefault()
    if (isLoggingIn) return

    const username = owner?.username || owner?.handle
    if (!username) {
      toast.error(t('auth.login.ownerUsernameMissing'))
      return
    }

    setIsLoggingIn(true)

    try {
      const result = await authClient.signIn.username({
        password,
        username,
      })

      if (result.error) {
        toast.error(result.error.message || t('auth.login.failed'))
        return
      }

      postSuccessfulLogin()
    } catch (error) {
      toast.error(readErrorMessage(error, t('auth.login.failed')))
    } finally {
      setIsLoggingIn(false)
    }
  }

  const handlePasskeyLogin = async () => {
    try {
      const result = await authClient.signIn.passkey()

      if (result.error) {
        toast.error(result.error.message || t('auth.login.passkeyFailed'))
        return
      }

      toast.success(t('auth.login.passkeySucceeded'))
      postSuccessfulLogin()
    } catch (error) {
      toast.error(readErrorMessage(error, t('auth.login.passkeyFailed')))
    }
  }

  const handleSocialLogin = (provider: 'apple' | 'github' | 'google') => {
    void authClient.signIn.social({
      callbackURL,
      provider,
    })
  }

  return (
    <AuthScene scene="login">
      <section className="auth-entry__step">
        <p className="mb-3 text-xs font-medium tracking-widest text-accent">
          YOUR SPACE, AWAITING YOU.
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {t('auth.entry.loginTitle')}
        </h1>
        <p className="mt-2 text-sm leading-6 text-fg-muted">
          {t('auth.entry.loginDescription')}
        </p>
        <div className="my-6 flex items-center gap-3 rounded-md border border-border bg-surface-page p-3">
          <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-accent-soft text-accent">
            {owner?.avatar ? (
              <img
                alt=""
                className="size-full object-cover"
                decoding="async"
                src={owner.avatar}
              />
            ) : (
              <span className="text-2xl font-semibold">
                {readInitial(owner)}
              </span>
            )}
          </div>

          <div className="min-w-0">
            <p className="truncate text-base font-medium">
              {owner?.name || owner?.username || 'Admin'}
            </p>
            {owner?.username || owner?.handle ? (
              <p className="mt-0.5 text-xs text-fg-subtle">
                @{owner.username || owner.handle}
              </p>
            ) : null}
          </div>
        </div>

        {showPasswordInput ? (
          <form
            className="flex w-full flex-col gap-4"
            onSubmit={handlePasswordLogin}
          >
            <div className="auth-entry__field relative">
              <TextInput
                aria-label={t('auth.login.passwordLabel')}
                autoComplete="current-password"
                disabled={isLoggingIn}
                id="password-input"
                label={t('auth.login.passwordLabel')}
                onChange={setPassword}
                placeholder={t('auth.login.passwordPlaceholder')}
                ref={inputRef}
                type={showPassword ? 'text' : 'password'}
                value={password}
              />
              <button
                aria-label={t(
                  showPassword
                    ? 'auth.entry.hidePassword'
                    : 'auth.entry.showPassword',
                )}
                className="absolute right-2 bottom-1.5 flex size-7 items-center justify-center rounded-sm text-fg-subtle hover:bg-surface-inset"
                onClick={() => setShowPassword((value) => !value)}
                type="button"
              >
                {showPassword ? (
                  <EyeOff aria-hidden="true" className="size-4" />
                ) : (
                  <Eye aria-hidden="true" className="size-4" />
                )}
              </button>
            </div>
            <Button
              className="auth-entry__submit"
              disabled={isLoggingIn}
              type="submit"
            >
              {isLoggingIn ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : null}
              {t('auth.entry.enter')}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Button>
          </form>
        ) : null}

        {hasAlternativeAuth ? (
          <div className="mt-5">
            {showPasswordInput ? (
              <div className="auth-entry__divider text-xs text-fg-subtle">
                {t('auth.entry.otherAuth')}
              </div>
            ) : null}
            {settings?.passkey ? (
              <Button
                className="auth-entry__submit mb-3"
                type="button"
                variant="secondary"
                onClick={handlePasskeyLogin}
              >
                <Fingerprint aria-hidden="true" className="size-4" />
                {t('auth.login.passkey')}
              </Button>
            ) : null}

            <div className="auth-entry__social">
              {settings?.github ? (
                <Button
                  aria-label={t('auth.login.github')}
                  type="button"
                  variant="secondary"
                  onClick={() => handleSocialLogin('github')}
                >
                  <GithubIcon />
                  GitHub
                </Button>
              ) : null}

              {settings?.google ? (
                <Button
                  aria-label={t('auth.login.google')}
                  type="button"
                  variant="secondary"
                  onClick={() => handleSocialLogin('google')}
                >
                  <GoogleIcon />
                  Google
                </Button>
              ) : null}

              {settings?.apple ? (
                <Button
                  aria-label={t('auth.login.apple')}
                  type="button"
                  variant="secondary"
                  onClick={() => handleSocialLogin('apple')}
                >
                  <AppleIcon />
                  Apple
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {ownerQuery.isLoading || allowLoginQuery.isLoading ? (
          <div className="mt-6 flex items-center gap-2 text-sm text-fg-muted">
            <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
            {t('auth.login.loadingProfile')}
          </div>
        ) : null}
        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-fg-subtle">
          <ShieldCheck aria-hidden="true" className="size-3" />
          {t('auth.entry.secure')}
        </p>
      </section>
    </AuthScene>
  )
}
