import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Cloud, Copy, ExternalLink, Info, Loader2, Lock } from 'lucide-react'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { toast } from 'sonner'

import type { LobeHubDeviceLogin } from '~/api/ai'
import {
  cancelLobeHubLogin,
  disconnectLobeHub,
  getLobeHubAccount,
  pollLobeHubLogin,
  startLobeHubLogin,
} from '~/api/ai'
import { useI18n } from '~/i18n'
import {
  Modal,
  ModalDescription,
  ModalFooter,
  ModalHeader,
} from '~/ui/feedback/modal'
import { Button } from '~/ui/primitives/button'

import { getErrorMessage } from '../../utils/settings'

const ACCOUNT_KEY = ['ai', 'lobehub', 'account'] as const

export function LobeHubConnection(props: {
  onConnected: () => Promise<void> | void
  onDisconnected: () => void
  onStatusChange?: (connected: boolean) => void
}) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const account = useQuery({
    queryKey: ACCOUNT_KEY,
    queryFn: getLobeHubAccount,
    staleTime: 0,
  })
  const [open, setOpen] = useState(false)
  const [starting, setStarting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [login, setLogin] = useState<LobeHubDeviceLogin | null>(null)
  const [terminal, setTerminal] = useState<'expired' | 'denied' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())
  const generation = useRef(0)
  const flow = useRef<string | null>(null)
  const connected = account.data?.status === 'connected'
  const remaining = login
    ? Math.max(0, Math.ceil((Date.parse(login.expiresAt) - now) / 1000))
    : 0

  useEffect(() => {
    props.onStatusChange?.(connected)
  }, [connected, props.onStatusChange])
  useEffect(
    () => () => {
      generation.current++
      if (flow.current) void cancelLobeHubLogin(flow.current).catch(() => {})
    },
    [],
  )

  const onConnected = useEffectEvent(async () => {
    await queryClient.invalidateQueries({ queryKey: ACCOUNT_KEY })
    await props.onConnected()
  })

  useEffect(() => {
    if (!open || !login || terminal || error) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    const clock = setInterval(() => setNow(Date.now()), 1000)
    async function poll() {
      if (cancelled) return
      if (Date.now() >= Date.parse(login!.expiresAt)) {
        setTerminal('expired')
        return
      }
      try {
        const result = await pollLobeHubLogin(login!.flowId)
        if (cancelled) return
        if (result.status === 'pending')
          timer = setTimeout(poll, result.intervalSeconds * 1000)
        else if (result.status === 'connected') {
          flow.current = null
          setOpen(false)
          setLogin(null)
          await onConnected()
        } else setTerminal(result.status)
      } catch (error) {
        if (!cancelled)
          setError(getErrorMessage(error, t('settings.ai.lobehub.error')))
      }
    }
    timer = setTimeout(poll, login.intervalSeconds * 1000)
    return () => {
      cancelled = true
      clearTimeout(timer)
      clearInterval(clock)
    }
  }, [open, login, terminal, error, t])

  function close() {
    generation.current++
    setOpen(false)
    setLogin(null)
    setStarting(false)
    if (flow.current) void cancelLobeHubLogin(flow.current).catch(() => {})
    flow.current = null
  }

  async function start() {
    const attempt = ++generation.current
    setOpen(true)
    setStarting(true)
    setError(null)
    setTerminal(null)
    setLogin(null)
    if (flow.current) void cancelLobeHubLogin(flow.current).catch(() => {})
    flow.current = null
    try {
      const login = await startLobeHubLogin()
      if (generation.current !== attempt) {
        void cancelLobeHubLogin(login.flowId).catch(() => {})
        return
      }
      flow.current = login.flowId
      setLogin(login)
      setNow(Date.now())
    } catch (error) {
      if (generation.current === attempt)
        setError(getErrorMessage(error, t('settings.ai.lobehub.error')))
    } finally {
      if (generation.current === attempt) setStarting(false)
    }
  }

  async function disconnect() {
    if (!window.confirm(t('settings.ai.lobehub.disconnectConfirm'))) return
    setDisconnecting(true)
    try {
      await disconnectLobeHub()
      queryClient.setQueryData(ACCOUNT_KEY, {
        status: 'disconnected',
        name: null,
        email: null,
      })
      props.onDisconnected()
    } catch (error) {
      toast.error(getErrorMessage(error, t('settings.ai.lobehub.error')))
    } finally {
      setDisconnecting(false)
    }
  }

  async function copyCode() {
    if (!login) return
    try {
      await navigator.clipboard.writeText(login.userCode)
      toast.success(t('settings.ai.lobehub.copied'))
    } catch {
      toast.error(t('settings.ai.lobehub.copyFailed'))
    }
  }

  return (
    <>
      <section className="overflow-hidden rounded-xl border border-border">
        <div className="flex items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-md border border-border bg-surface-inset">
              <Cloud aria-hidden className="size-5" />
            </span>
            <div>
              <p className="text-sm font-medium">LobeHub Cloud</p>
              <p className="text-xs text-fg-muted">
                {t('settings.ai.lobehub.account')}
              </p>
            </div>
          </div>
          <span
            className={
              connected
                ? 'text-xs text-emerald-600 dark:text-emerald-400'
                : 'text-xs text-fg-muted'
            }
          >
            {connected
              ? t('settings.ai.lobehub.connected')
              : t('settings.ai.lobehub.disconnected')}
          </span>
        </div>
        <div className="space-y-3 px-4 pb-4">
          {account.isPending ? (
            <Loader2
              aria-label={t('settings.ai.lobehub.preparing')}
              className="size-4 animate-spin text-fg-muted"
            />
          ) : account.isError ? (
            <div role="alert" className="space-y-2">
              <p className="text-sm text-fg-muted">
                {getErrorMessage(account.error, t('settings.ai.lobehub.error'))}
              </p>
              <Button onClick={() => void account.refetch()} variant="subtle">
                {t('common.retry')}
              </Button>
            </div>
          ) : connected ? (
            <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
              <div>
                <p className="text-sm font-medium">
                  {account.data?.name || 'LobeHub'}
                </p>
                <p className="text-xs text-fg-muted">{account.data?.email}</p>
              </div>
              <Button
                disabled={disconnecting}
                onClick={() => void disconnect()}
                variant="ghost"
              >
                {disconnecting ? (
                  <Loader2 aria-hidden className="size-4 animate-spin" />
                ) : null}
                {t('settings.ai.lobehub.disconnect')}
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm leading-relaxed text-fg-muted">
                {t(
                  account.data?.status === 'refresh_required'
                    ? 'settings.ai.lobehub.refreshRequired'
                    : 'settings.ai.lobehub.description',
                )}
              </p>
              <Button className="w-full" onClick={() => void start()}>
                <ExternalLink aria-hidden className="size-4" />
                {t(
                  account.data?.status === 'refresh_required'
                    ? 'settings.ai.lobehub.reconnect'
                    : 'settings.ai.lobehub.login',
                )}
              </Button>
            </>
          )}
        </div>
        <p className="flex items-center gap-2 border-t border-border bg-surface-inset px-4 py-3 text-xs text-fg-muted">
          <Lock aria-hidden className="size-3 shrink-0" />
          {t('settings.ai.lobehub.safety')}
        </p>
      </section>
      <p className="flex items-start gap-2 text-xs leading-relaxed text-fg-muted">
        <Info aria-hidden className="mt-0.5 size-3 shrink-0" />
        {t('settings.ai.lobehub.saved')}
      </p>
      <Modal className="w-[min(92vw,28rem)]" onClose={close} open={open}>
        <ModalHeader icon={Cloud} title={t('settings.ai.lobehub.title')} />
        <ModalDescription className="sr-only">
          {t('settings.ai.lobehub.description')}
        </ModalDescription>
        <div className="space-y-5 p-5">
          {starting ? (
            <p className="flex items-center gap-2 text-sm text-fg-muted">
              <Loader2 aria-hidden className="size-4 animate-spin" />
              {t('settings.ai.lobehub.preparing')}
            </p>
          ) : error || terminal ? (
            <div
              role="alert"
              className="rounded-md bg-surface-inset p-4 text-sm leading-relaxed text-fg-muted"
            >
              {error ||
                t(
                  terminal === 'expired'
                    ? 'settings.ai.lobehub.expired'
                    : 'settings.ai.lobehub.denied',
                )}
            </div>
          ) : login ? (
            <>
              <div className="flex gap-3">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-surface-inset text-xs text-fg-muted">
                  1
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {t('settings.ai.lobehub.stepCode')}
                  </p>
                  <p className="mt-1 text-xs text-fg-muted">
                    {t('settings.ai.lobehub.codeHint')}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-2 rounded-md border border-border bg-surface-inset p-3">
                    <code className="min-w-0 break-all font-mono text-2xl font-semibold tracking-widest">
                      {login.userCode}
                    </code>
                    <Button
                      aria-label={t('settings.ai.lobehub.copyCode')}
                      iconOnly
                      onClick={() => void copyCode()}
                      variant="subtle"
                    >
                      <Copy aria-hidden className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-surface-inset text-xs text-fg-muted">
                  2
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {t('settings.ai.lobehub.stepAuthorize')}
                  </p>
                  <p className="mt-1 text-xs text-fg-muted">
                    {t('settings.ai.lobehub.authorizeHint')}
                  </p>
                  <Button
                    className="mt-3 w-full"
                    nativeButton={false}
                    render={
                      <a
                        href={
                          login.verificationUriComplete || login.verificationUri
                        }
                        rel="noreferrer"
                        target="_blank"
                      />
                    }
                  >
                    <ExternalLink aria-hidden className="size-4" />
                    {t('settings.ai.lobehub.openPage')}
                  </Button>
                </div>
              </div>
              <p
                aria-live="polite"
                className="flex items-center gap-2 text-xs text-fg-muted"
              >
                <Loader2 aria-hidden className="size-3 animate-spin" />
                {t('settings.ai.lobehub.waiting', {
                  time: `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`,
                })}
              </p>
            </>
          ) : null}
        </div>
        <p className="flex items-center gap-2 border-t border-border bg-surface-inset px-5 py-3 text-xs text-fg-muted">
          <Lock aria-hidden className="size-3 shrink-0" />
          {t('settings.ai.lobehub.safety')}
        </p>
        <ModalFooter>
          <Button onClick={close} variant="subtle">
            {t('settings.ai.lobehub.cancel')}
          </Button>
          {error || terminal ? (
            <Button onClick={() => void start()}>
              {t('settings.ai.lobehub.retry')}
            </Button>
          ) : null}
        </ModalFooter>
      </Modal>
    </>
  )
}
