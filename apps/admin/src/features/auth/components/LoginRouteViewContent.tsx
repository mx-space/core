import { useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Loader2 } from 'lucide-react'
import type { FormEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { getJson } from '~/api/http'
import { bgUrl } from '~/constants/env'
import { SESSION_WITH_LOGIN } from '~/constants/keys'
import { useI18n } from '~/i18n'
import type { UserModel } from '~/models/user'
import { TextInput } from '~/ui/primitives/text-field'
import { authClient } from '~/utils/authjs/auth'

import {
  allowLoginQueryKey,
  initQueryKey,
  loggedStatusQueryKey,
  ownerQueryKey,
} from '../constants'
import type { AllowLoginResponse } from '../types/login'
import { checkIsInit } from '../utils/check-init'
import { readErrorMessage, readInitial } from '../utils/login'
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
    Boolean(settings?.google)

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

  const handleSocialLogin = (provider: 'github' | 'google') => {
    void authClient.signIn.social({
      callbackURL,
      provider,
    })
  }

  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-neutral-950 p-4 text-white"
      style={{
        backgroundImage: `linear-gradient(rgba(10,10,10,.42), rgba(10,10,10,.58)), url(${bgUrl})`,
        backgroundPosition: 'center',
        backgroundSize: 'cover',
      }}
    >
      <section className="flex w-full max-w-sm flex-col items-center">
        <div className="mb-4 size-[120px] overflow-hidden rounded-full bg-white/15 shadow-2xl ring-4 ring-white/30">
          {owner?.avatar ? (
            <img
              alt=""
              className="size-full object-cover"
              decoding="async"
              src={owner.avatar}
            />
          ) : (
            <div className="flex size-full items-center justify-center text-3xl font-medium">
              {readInitial(owner)}
            </div>
          )}
        </div>

        <h1 className="mb-6 text-xl font-medium tracking-wide drop-shadow-lg">
          {owner?.name || owner?.username || 'Admin'}
        </h1>

        {showPasswordInput ? (
          <form className="w-full max-w-[280px]" onSubmit={handlePasswordLogin}>
            <label className="sr-only" htmlFor="password-input">
              {t('auth.login.passwordLabel')}
            </label>
            <div className="relative">
              <TextInput
                autoComplete="current-password"
                controlClassName="h-[38px] rounded-full border-0 bg-white/20 px-4 text-center text-sm text-white backdrop-blur-md placeholder:text-white/60 focus:bg-white/25 focus:ring-2 focus:ring-white/50 dark:border-0 dark:bg-white/20 dark:text-white"
                disabled={isLoggingIn}
                id="password-input"
                onChange={setPassword}
                placeholder={t('auth.login.passwordPlaceholder')}
                ref={inputRef}
                type="password"
                value={password}
              />
              <button className="sr-only" type="submit">
                {t('auth.login.submit')}
              </button>
            </div>
          </form>
        ) : null}

        {hasAlternativeAuth ? (
          <div className="mt-6 flex justify-center gap-4">
            {settings?.passkey ? (
              <LoginIconButton
                label={t('auth.login.passkey')}
                onClick={handlePasskeyLogin}
              >
                <KeyRound aria-hidden="true" className="!size-5" />
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
          </div>
        ) : null}

        {ownerQuery.isLoading || allowLoginQuery.isLoading ? (
          <div className="mt-6 flex items-center gap-2 text-xs text-white/70">
            <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
            {t('auth.login.loadingProfile')}
          </div>
        ) : null}
      </section>
    </main>
  )
}
