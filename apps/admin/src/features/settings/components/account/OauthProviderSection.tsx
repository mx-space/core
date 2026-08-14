import { Copy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { API_URL } from '~/constants/env'
import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'
import { Switch } from '~/ui/primitives/switch'
import { TextArea, TextInput } from '~/ui/primitives/text-field'
import { authClient } from '~/utils/authjs/auth'

import type {
  FlatOauthProvider,
  OauthProviderField,
  OauthProviderPayload,
  OauthProviderType,
} from '../../types/settings'
import { AppleIcon, GitHubIcon, GoogleIcon } from './OauthIcons'

const providerIcons = {
  apple: AppleIcon,
  github: GitHubIcon,
  google: GoogleIcon,
} satisfies Record<OauthProviderType, unknown>

function initialValues(
  fields: OauthProviderField[],
  data: FlatOauthProvider,
): Record<string, string> {
  return Object.fromEntries(
    fields.map((field) => [
      field.key,
      field.secret ? '' : (data.public[field.key] ?? ''),
    ]),
  )
}

export function OauthProviderSection(props: {
  data: FlatOauthProvider
  fields: OauthProviderField[]
  label: string
  onSave: (payload: OauthProviderPayload) => void
  saving: boolean
  type: OauthProviderType
}) {
  const { t } = useI18n()
  const [enabled, setEnabled] = useState(props.data.enabled)
  const [values, setValues] = useState(() =>
    initialValues(props.fields, props.data),
  )
  const callbackUrl = `${API_URL}/auth/callback/${props.type}`

  useEffect(() => {
    setEnabled(props.data.enabled)
    setValues(initialValues(props.fields, props.data))
  }, [props.data, props.fields])

  const validate = () => {
    const callback = new URL(location.href)
    callback.searchParams.set('validate', props.type)
    void authClient.signIn.social({
      callbackURL: callback.toString(),
      provider: props.type,
    })
  }

  const isMissing = (field: OauthProviderField) => {
    if (field.optional) return false
    // A stored secret is never read back, so leaving it blank keeps the
    // existing value instead of clearing it.
    if (field.secret && props.data.configured) return false
    return !values[field.key]?.trim()
  }

  const save = () => {
    const payload: OauthProviderPayload = {
      enabled,
      public: {},
      secrets: {},
      type: props.type,
    }
    for (const field of props.fields) {
      const value = values[field.key]?.trim() ?? ''
      if (field.secret) {
        if (value) payload.secrets[field.key] = value
      } else {
        payload.public[field.key] = value
      }
    }
    props.onSave(payload)
  }

  const Icon = providerIcons[props.type]

  return (
    <section className="py-4">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex size-8 items-center justify-center rounded bg-neutral-100 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
          <Icon aria-hidden="true" className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {props.label}
          </h3>
        </div>
        <Switch
          checked={enabled}
          label={t('settings.oauth.switch.enabled')}
          onCheckedChange={setEnabled}
        />
      </div>

      <div className="grid gap-3">
        {props.fields.map((field) => {
          const placeholder =
            field.secret && props.data.configured
              ? t('settings.oauth.secretKeptPlaceholder')
              : field.placeholderKey
                ? t(field.placeholderKey)
                : field.placeholder
          const onChange = (value: string) =>
            setValues((prev) => ({ ...prev, [field.key]: value }))

          return field.multiline ? (
            <TextArea
              key={field.key}
              label={field.label}
              onChange={onChange}
              placeholder={placeholder}
              spellCheck={false}
              value={values[field.key] ?? ''}
            />
          ) : (
            <TextInput
              key={field.key}
              label={field.label}
              onChange={onChange}
              placeholder={placeholder}
              type={field.secret ? 'password' : 'text'}
              value={values[field.key] ?? ''}
            />
          )
        })}

        <div className="grid gap-1.5 text-sm">
          <span className="text-neutral-600 dark:text-neutral-300">
            {t('settings.oauth.callbackLabel')}
          </span>
          <div className="flex items-center gap-2 rounded bg-neutral-50 px-3 py-2 dark:bg-neutral-900">
            <code className="min-w-0 flex-1 truncate text-xs text-neutral-600 dark:text-neutral-300">
              {callbackUrl}
            </code>
            <Button
              aria-label={t('settings.oauth.callbackCopyAria')}
              className="h-7 px-2"
              onClick={() => {
                void navigator.clipboard.writeText(callbackUrl)
                toast.success(t('settings.oauth.copySuccess'))
              }}
              type="button"
              variant="subtle"
            >
              <Copy aria-hidden="true" className="size-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button onClick={validate} type="button" variant="subtle">
            {t('settings.oauth.action.validate')}
          </Button>
          <Button
            disabled={props.saving || props.fields.some(isMissing)}
            onClick={save}
            type="button"
          >
            {t('settings.oauth.action.save')}
          </Button>
        </div>
      </div>
    </section>
  )
}
