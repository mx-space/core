import { Bug, Check, RotateCcw, Server } from 'lucide-react'
import type { FormEvent } from 'react'
import { useMemo, useState } from 'react'

import { useI18n } from '~/i18n'
import {
  authBackdropClassName,
  authBackdropStyle,
  authCardClassName,
  authDescriptionClassName,
  authIconTileClassName,
  authTitleClassName,
} from '~/lib/auth-backdrop'
import { Button } from '~/ui/primitives/button'
import { FormSwitch } from '~/ui/primitives/switch'
import { TextInput } from '~/ui/primitives/text-field'
import { cn } from '~/utils/cn'

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
    <main
      className={cn(authBackdropClassName, 'flex items-center justify-center')}
      style={authBackdropStyle}
    >
      <form
        className={cn(authCardClassName, 'max-w-md')}
        onSubmit={handleSubmit}
      >
        <header className="mb-6 flex items-center gap-3">
          <div className={authIconTileClassName}>
            <Server aria-hidden="true" className="size-5" />
          </div>
          <div className="min-w-0">
            <h1 className={authTitleClassName}>{t('setup.api.title')}</h1>
            <p className={authDescriptionClassName}>
              {t('setup.api.description')}
            </p>
          </div>
        </header>

        <div className="space-y-4">
          <SetupInput
            history={historyApiUrl}
            label={t('setup.api.urlLabel')}
            onChange={setApiUrl}
            value={apiUrl}
          />

          <SetupInput
            history={historyGatewayUrl}
            label={t('setup.api.gatewayLabel')}
            onChange={setGatewayUrl}
            value={gatewayUrl}
          />

          <FormSwitch
            checked={persist}
            label={t('setup.api.persistLabel')}
            onCheckedChange={setPersist}
          />
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button onClick={handleLocalDev} type="button" variant="secondary">
            <Bug aria-hidden="true" className="size-4" />
            {t('setup.api.actions.localDev')}
          </Button>
          <Button onClick={handleReset} type="button" variant="secondary">
            <RotateCcw aria-hidden="true" className="size-4" />
            {t('setup.api.actions.reset')}
          </Button>
          <Button type="submit">
            <Check aria-hidden="true" className="size-4" />
            {t('common.confirm')}
          </Button>
        </div>
      </form>
    </main>
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
