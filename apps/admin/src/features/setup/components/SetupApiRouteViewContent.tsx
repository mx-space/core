import {
  ArrowRight,
  Bug,
  ChevronDown,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react'
import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'

import { AuthScene } from '~/features/auth/entry/AuthExperience'
import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { FormSwitch } from '~/ui/primitives/switch'
import { TextInput } from '~/ui/primitives/text-field'

const storeApiUrlKey = 'mx-admin:setup-api:url'
const storeGatewayUrlKey = 'mx-admin:setup-api:gateway'

export function SetupApiRouteViewContent() {
  const { t } = useI18n()
  const [apiUrl, setApiUrl] = useState(
    () =>
      localStorage.getItem('__api') ||
      `${location.protocol}//${location.host}/api/v2`,
  )
  const [gatewayUrl, setGatewayUrl] = useState(
    () =>
      localStorage.getItem('__gateway') ||
      `${location.protocol}//${location.host}`,
  )
  const [persist, setPersist] = useState(true)

  const historyApiUrl = useMemo(
    () => readStringArray(localStorage.getItem(storeApiUrlKey)),
    [],
  )
  const historyGatewayUrl = useMemo(
    () => readStringArray(localStorage.getItem(storeGatewayUrlKey)),
    [],
  )

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()

    const fullApiUrl = transformFullUrl(apiUrl)
    const fullGatewayUrl = transformFullUrl(gatewayUrl)
    const storage = persist ? localStorage : sessionStorage

    if (fullApiUrl) storage.setItem('__api', fullApiUrl)
    if (fullGatewayUrl) storage.setItem('__gateway', fullGatewayUrl)

    localStorage.setItem(
      storeApiUrlKey,
      JSON.stringify([...new Set(historyApiUrl.concat(fullApiUrl || apiUrl))]),
    )
    localStorage.setItem(
      storeGatewayUrlKey,
      JSON.stringify([
        ...new Set(historyGatewayUrl.concat(fullGatewayUrl || gatewayUrl)),
      ]),
    )

    const url = new URL(location.href)
    url.hash = '#/dashboard'
    location.href = url.toString()
    location.reload()
  }

  const handleReset = () => {
    localStorage.removeItem('__api')
    localStorage.removeItem('__gateway')
    sessionStorage.removeItem('__api')
    sessionStorage.removeItem('__gateway')

    location.href = location.pathname
    location.hash = ''
  }

  const handleLocalDev = () => {
    setApiUrl('http://localhost:2333')
    setGatewayUrl('http://localhost:2333')
  }

  return (
    <AuthScene scene="connect">
      <form
        className="auth-entry__step auth-entry__field"
        onSubmit={handleSubmit}
      >
        <header className="mb-7">
          <p className="mb-3 text-xs font-medium tracking-widest text-accent">
            EVERY SPACE STARTS WITH A CONNECTION.
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {t('auth.entry.connectTitle')}
          </h1>
          <p className="mt-2 text-sm leading-6 text-fg-muted">
            {t('auth.entry.connectDescription')}
          </p>
        </header>

        <div className="space-y-4">
          <div>
            <SetupInput
              history={historyApiUrl}
              label={t('setup.api.urlLabel')}
              onChange={setApiUrl}
              value={apiUrl}
            />
            <p className="mt-2 text-xs leading-5 text-fg-subtle">
              {t('auth.entry.apiHint')}
            </p>
          </div>

          <details className="group border-y border-border py-3">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm text-fg-muted">
              <SlidersHorizontal aria-hidden="true" className="size-3.5" />
              {t('auth.entry.advanced')}
              <ChevronDown
                aria-hidden="true"
                className="ml-auto size-3.5 transition-transform group-open:rotate-180"
              />
            </summary>
            <div className="mt-4">
              <SetupInput
                history={historyGatewayUrl}
                label={t('setup.api.gatewayLabel')}
                onChange={setGatewayUrl}
                value={gatewayUrl}
              />
            </div>
          </details>

          <FormSwitch
            checked={persist}
            label={t('setup.api.persistLabel')}
            onCheckedChange={setPersist}
          />
        </div>

        <Button className="auth-entry__submit mt-6" type="submit">
          {t('auth.entry.saveConnect')}
          <ArrowRight aria-hidden="true" className="size-4" />
        </Button>
        <div className="mt-2 flex items-center justify-between gap-2">
          <Button onClick={handleLocalDev} type="button" variant="ghost">
            <Bug aria-hidden="true" className="size-4" />
            {t('setup.api.actions.localDev')}
          </Button>
          <Button onClick={handleReset} type="button" variant="ghost">
            <RotateCcw aria-hidden="true" className="size-4" />
            {t('setup.api.actions.reset')}
          </Button>
        </div>
      </form>
    </AuthScene>
  )
}

interface SetupInputProps {
  history: string[]
  label: string
  onChange: (value: string) => void
  value: string
}

function SetupInput(props: SetupInputProps) {
  const listId = `${props.label.replaceAll(/\s+/g, '-')}-history`

  return (
    <>
      <TextInput
        label={props.label}
        list={listId}
        onChange={props.onChange}
        value={props.value}
      />
      <datalist id={listId}>
        {props.history.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>
    </>
  )
}

function transformFullUrl(url: string): string {
  if (!url) return ''
  if (url.startsWith('http')) return url

  const protocol = ['localhost', '127.0.0.1'].includes(url) ? 'http' : 'https'
  return `${protocol}://${url}`
}

function readStringArray(value: null | string): string[] {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []

    return parsed.filter((item): item is string => typeof item === 'string')
  } catch {
    return []
  }
}
