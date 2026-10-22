import { useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Loader2 } from 'lucide-react'
import type { FormEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { getJson } from '~/api/http'
import { SESSION_WITH_LOGIN } from '~/constants/keys'
import { useI18n } from '~/i18n'
import {
  authBackdropClassName,
  authBackdropStyle,
  authCardClassName,
  authIconTileClassName,
  authTitleClassName,
} from '~/lib/auth-backdrop'
import type { UserModel } from '~/models/user'
import { Button } from '~/ui/primitives/button'
import { TextInput } from '~/ui/primitives/text-field'
import { authClient } from '~/utils/authjs/auth'
import { cn } from '~/utils/cn'

import {
  allowLoginQueryKey,
  initQueryKey,
  loggedStatusQueryKey,
  ownerQueryKey,
} from '../constants'
import type { AllowLoginResponse } from '../types/login'
import { checkIsInit } from '../utils/check-init'
import { readErrorMessage, readInitial } from '../utils/login'
import { AppleIcon } from './AppleIcon'
import { GithubIcon } from './GithubIcon'
import { GoogleIcon } from './GoogleIcon'
import { LoginIconButton } from './LoginIconButton'

export function LoginRouteViewContent() {
  const { t } = useI18n()
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const [password, setPassword] = useState('')
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
    const focusInput = () => inputRef.current?.focus()

    focusInput()
    document.addEventListener('keydown', focusInput)

    return () => document.removeEventListener('keydown', focusInput)
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
    <main
      className={cn(authBackdropClassName, 'flex items-center justify-center')}
      style={authBackdropStyle}
    >
      <section
        className={cn(authCardClassName, 'flex max-w-sm flex-col items-center')}
      >
        <div className={authIconTileClassName}>
          {owner?.avatar ? (
            <img
              alt=""
              className="size-full object-cover"
              decoding="async"
              src={owner.avatar}
            />
          ) : (
            <span className="text-2xl font-semibold">{readInitial(owner)}</span>
          )}
        </div>

        <h1 className={cn(authTitleClassName, 'mt-4 text-center')}>
          {owner?.name || owner?.username || 'Admin'}
        </h1>

        {showPasswordInput ? (
          <form
            className="mt-6 flex w-full flex-col gap-3"
            onSubmit={handlePasswordLogin}
          >
            <TextInput
              aria-label={t('auth.login.passwordLabel')}
              autoComplete="current-password"
              disabled={isLoggingIn}
              id="password-input"
              onChange={setPassword}
              placeholder={t('auth.login.passwordPlaceholder')}
              ref={inputRef}
              type="password"
              value={password}
            />
            <Button className="w-full" disabled={isLoggingIn} type="submit">
              {isLoggingIn ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : null}
              {t('auth.login.submit')}
            </Button>
          </form>
        ) : null}

        {hasAlternativeAuth ? (
          <div
            className={cn(
              'flex w-full justify-center gap-2',
              showPasswordInput ? 'mt-6 border-t border-border pt-6' : 'mt-6',
            )}
          >
            {settings?.passkey ? (
              <LoginIconButton
                label={t('auth.login.passkey')}
                onClick={handlePasskeyLogin}
              >
                <KeyRound aria-hidden="true" className="size-4" />
              </LoginIconButton>
            ) : null}

            {settings?.github ? (
              <LoginIconButton
                label={t('auth.login.github')}
                onClick={() => handleSocialLogin('github')}
              >
                <GithubIcon />
              </LoginIconButton>
            ) : null}

            {settings?.google ? (
              <LoginIconButton
                label={t('auth.login.google')}
                onClick={() => handleSocialLogin('google')}
              >
                <GoogleIcon />
              </LoginIconButton>
            ) : null}

            {settings?.apple ? (
              <LoginIconButton
                label={t('auth.login.apple')}
                onClick={() => handleSocialLogin('apple')}
              >
                <AppleIcon />
              </LoginIconButton>
            ) : null}
          </div>
        ) : null}

        {ownerQuery.isLoading || allowLoginQuery.isLoading ? (
          <div className="mt-6 flex items-center gap-2 text-sm text-fg-muted">
            <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
            {t('auth.login.loadingProfile')}
          </div>
        ) : null}
      </section>
    </main>
  )
}
