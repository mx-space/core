import { KeyRound, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

import { useI18n } from '~/i18n'
import { AppPage, PageHeader } from '~/ui/layout/page-layout'
import { Button } from '~/ui/primitives/button'
import { Panel } from '~/ui/primitives/panel'
import { Scroll } from '~/ui/primitives/scroll'
import { authClient } from '~/utils/authjs/auth'

export function AuthnDebugRouteViewContent() {
  const { t } = useI18n()

  return (
    <AppPage>
      <PageHeader
        description={t('debug.authn.headerDescription')}
        title={t('debug.authn.headerTitle')}
      />
      <Scroll
        className="min-h-0 flex-1"
        innerClassName="mx-auto w-full max-w-3xl p-4"
      >
        <Panel
          description={t('debug.authn.panelDescription')}
          title={t('debug.authn.panelTitle')}
        >
          <div className="grid gap-4 p-4 md:grid-cols-2">
            <DiagnosticAction
              description={t('debug.authn.action.register.description')}
              icon={KeyRound}
              label={t('debug.authn.action.register.label')}
              onClick={() =>
                registerPasskey({
                  registerFailed: t('debug.authn.registerFailed'),
                  registerSuccess: t('debug.authn.registerSuccess'),
                  passkeyAlreadyRegistered: t(
                    'debug.authn.passkeyAlreadyRegistered',
                  ),
                })
              }
            />
            <DiagnosticAction
              description={t('debug.authn.action.authenticator.description')}
              icon={ShieldCheck}
              label={t('debug.authn.action.authenticator.label')}
              onClick={() =>
                authenticatePasskey({
                  authenticateFailed: t('debug.authn.authenticateFailed'),
                  authenticateSuccess: t('debug.authn.authenticateSuccess'),
                })
              }
            />
          </div>
        </Panel>
      </Scroll>
    </AppPage>
  )
}

interface DiagnosticActionProps {
  description: string
  icon: typeof KeyRound
  label: string
  onClick: () => Promise<void>
}

function DiagnosticAction(props: DiagnosticActionProps) {
  const Icon = props.icon

  return (
    <section className="rounded border border-neutral-200 p-4 dark:border-neutral-800">
      <Icon
        aria-hidden="true"
        className="mb-4 size-5 text-[var(--color-primary)]"
      />
      <h3 className="text-sm font-medium">{props.label}</h3>
      <p className="mb-4 mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
        {props.description}
      </p>
      <Button onClick={props.onClick} type="button" variant="subtle">
        {props.label}
      </Button>
    </section>
  )
}

interface RegisterMessages {
  passkeyAlreadyRegistered: string
  registerFailed: string
  registerSuccess: string
}

async function registerPasskey(messages: RegisterMessages) {
  try {
    const name = `test-${Math.trunc(Math.random() * 100)}`
    const result = await authClient.passkey.addPasskey({ name })

    if (result.error) {
      toast.error(result.error.message || messages.registerFailed)
    } else {
      toast.success(messages.registerSuccess)
    }
  } catch (error) {
    if (isNamedError(error, 'InvalidStateError')) {
      toast.error(messages.passkeyAlreadyRegistered)
    } else {
      toast.error(readErrorMessage(error, messages.registerFailed))
    }
  }
}

interface AuthenticateMessages {
  authenticateFailed: string
  authenticateSuccess: string
}

async function authenticatePasskey(messages: AuthenticateMessages) {
  try {
    const result = await authClient.signIn.passkey()

    if (result.error) {
      toast.error(result.error.message || messages.authenticateFailed)
    } else {
      toast.success(messages.authenticateSuccess)
    }
  } catch (error) {
    toast.error(readErrorMessage(error, messages.authenticateFailed))
  }
}

function isNamedError(error: unknown, name: string) {
  return error instanceof Error && error.name === name
}

function readErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message || fallback : fallback
}
