import { Bug, Check, RotateCcw, Server } from 'lucide-react'
import { FormEvent, useMemo, useState } from 'react'

import { useI18n } from '~/i18n'
import { Switch } from '~/ui/primitives/switch'
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
    <main className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 p-4 text-white">
      <div className="mb-4 flex size-20 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-md">
        <Server aria-hidden="true" className="size-10" />
      </div>

      <h1 className="mb-2 text-xl font-medium tracking-wide">
        {t('setup.api.title')}
      </h1>
      <p className="mb-8 text-sm text-white/70">{t('setup.api.description')}</p>

      <form
        className="w-full max-w-md rounded-2xl border border-white/20 bg-white/10 p-6 backdrop-blur-xl"
        onSubmit={handleSubmit}
      >
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

        <div className="mb-6 text-white/90">
          <Switch
            checked={persist}
            label={t('setup.api.persistLabel')}
            onCheckedChange={setPersist}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <SetupActionButton
            icon={Bug}
            label={t('setup.api.actions.localDev')}
            onClick={handleLocalDev}
            type="button"
          />
          <SetupActionButton
            icon={RotateCcw}
            label={t('setup.api.actions.reset')}
            onClick={handleReset}
            type="button"
          />
          <SetupActionButton
            icon={Check}
            label={t('common.confirm')}
            tone="primary"
            type="submit"
          />
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
  const listId = `${props.label.replace(/\s+/g, '-')}-history`

  return (
    <div className="mb-4">
      <label className="mb-2 block text-sm font-medium text-white/90">
        {props.label}
      </label>
      <TextInput
        controlClassName="border-white/15 bg-white/15 text-white placeholder:text-white/40 focus:border-white/50 focus:bg-white/20 dark:border-white/15 dark:bg-white/15 dark:text-white"
        list={listId}
        onChange={props.onChange}
        value={props.value}
      />
      <datalist id={listId}>
        {props.history.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>
    </div>
  )
}

interface SetupActionButtonProps {
  icon: typeof Bug
  label: string
  onClick?: () => void
  tone?: 'default' | 'primary'
  type: 'button' | 'submit'
}

function SetupActionButton({
  icon: Icon,
  label,
  onClick,
  tone = 'default',
  type,
}: SetupActionButtonProps) {
  return (
    <button
      aria-label={label}
      className={
        tone === 'primary'
          ? 'focus-visible:outline-hidden flex h-10 items-center justify-center gap-2 rounded-full bg-white/90 text-sm font-medium text-neutral-950 transition-colors hover:bg-white focus-visible:ring-2 focus-visible:ring-white/50'
          : 'focus-visible:outline-hidden flex h-10 items-center justify-center gap-2 rounded-full bg-white/15 text-sm text-white/90 transition-colors hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-white/50'
      }
      onClick={onClick}
      type={type}
    >
      <Icon aria-hidden="true" className="size-4" />
      <span>{label}</span>
    </button>
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
