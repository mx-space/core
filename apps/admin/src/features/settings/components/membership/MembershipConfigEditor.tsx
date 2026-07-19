import { useQuery } from '@tanstack/react-query'
import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  KeyRound,
  PackageOpen,
  PlugZap,
  Webhook,
} from 'lucide-react'
import { toast } from 'sonner'

import { getMembershipConfigStatus } from '~/api/membership'
import type { ConfigFormField } from '~/api/options'
import { API_URL } from '~/constants/env'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'
import { Badge } from '~/ui/primitives/badge'
import { Button } from '~/ui/primitives/button'
import { SelectField } from '~/ui/primitives/select'
import { Toggle } from '~/ui/primitives/switch'
import { TextInput } from '~/ui/primitives/text-field'

import {
  buildMembershipWebhookUrl,
  getMembershipSetupChecks,
  MEMBERSHIP_WEBHOOK_EVENTS,
  type MembershipConfigValue,
} from '../../utils/membership'

const DODO_SUBSCRIPTION_DOCS_URL =
  'https://docs.dodopayments.com/cn/features/subscription'
const DODO_WEBHOOK_DOCS_URL =
  'https://docs.dodopayments.com/developer-resources/webhooks'

function GuideSectionHeading(props: {
  description: string
  icon: LucideIcon
  title: string
}) {
  const Icon = props.icon

  return (
    <div>
      <div className="flex items-center gap-2">
        <Icon aria-hidden="true" className="size-4 text-fg-muted" />
        <h3 className="text-sm font-medium text-fg">{props.title}</h3>
      </div>
      <p className="mt-2 max-w-xs text-xs leading-5 text-fg-muted">
        {props.description}
      </p>
    </div>
  )
}

function SelectControl(props: {
  id: string
  label: string
  onChange: (value: string) => void
  options: Array<{ label: string; value: string }>
  value: string
}) {
  return (
    <div className="grid gap-1.5 text-sm">
      <label className="font-medium text-fg" htmlFor={props.id}>
        {props.label}
      </label>
      <SelectField
        id={props.id}
        onValueChange={props.onChange}
        options={props.options}
        value={props.value}
      />
    </div>
  )
}

function SecretField(props: {
  configured: boolean
  description: string
  keepHint: string
  label: string
  onChange: (value: string) => void
  placeholder: string
  value: string
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-fg">{props.label}</span>
        {props.configured ? (
          <Badge size="sm" tone="success" variant="soft">
            <Check aria-hidden="true" className="size-3" />
            {props.keepHint}
          </Badge>
        ) : null}
      </div>
      <TextInput
        aria-label={props.label}
        autoComplete="off"
        onChange={props.onChange}
        placeholder={props.placeholder}
        type="password"
        value={props.value}
      />
      <p className="text-xs leading-5 text-fg-muted">{props.description}</p>
    </div>
  )
}

function getStringOptions(fields: ConfigFormField[], key: string) {
  const options = fields.find((field) => field.key === key)?.ui.options ?? []
  return options.flatMap((option) =>
    typeof option.value === 'string'
      ? [{ label: option.label, value: option.value }]
      : [],
  )
}

export function MembershipConfigEditor(props: {
  fields: ConfigFormField[]
  onChange: (value: MembershipConfigValue) => void
  value: MembershipConfigValue
}) {
  const { t } = useI18n()
  const statusQuery = useQuery({
    queryFn: getMembershipConfigStatus,
    queryKey: adminQueryKeys.settings.membershipConfigStatus(),
  })

  const provider = props.value.provider || 'dodo'
  const environment = props.value.environment || 'live_mode'
  const status = statusQuery.data ?? {
    apiKeyConfigured: false,
    supportedProviders: ['dodo'],
    webhookSigningKeyConfigured: false,
  }
  const checks = getMembershipSetupChecks(props.value, status)
  const completedCount = Object.values(checks).filter(Boolean).length
  const totalCount = Object.keys(checks).length
  const setupComplete = completedCount === totalCount
  const providerSupported = checks.provider
  const apiKeyConfigured =
    Boolean(props.value.apiKey?.trim()) || status.apiKeyConfigured
  const webhookKeyConfigured =
    Boolean(props.value.webhookSigningKey?.trim()) ||
    status.webhookSigningKeyConfigured
  const webhookUrl = buildMembershipWebhookUrl(
    API_URL || location.origin,
    provider,
  )
  const rawProviderOptions = getStringOptions(props.fields, 'provider')
  const providerOptions = rawProviderOptions.map((option) => ({
    ...option,
    label: status.supportedProviders.includes(option.value)
      ? option.label
      : `${option.label} · ${t('settings.membership.provider.soon')}`,
  }))
  const environmentOptions = getStringOptions(props.fields, 'environment').map(
    (option) => ({
      ...option,
      label:
        option.value === 'live_mode'
          ? t('settings.membership.environment.live')
          : t('settings.membership.environment.test'),
    }),
  )
  const providerLabel =
    rawProviderOptions.find((option) => option.value === provider)?.label ??
    provider

  const update = <TKey extends keyof MembershipConfigValue>(
    key: TKey,
    value: MembershipConfigValue[TKey],
  ) => props.onChange({ ...props.value, [key]: value })

  const copyWebhookUrl = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl)
      toast.success(t('settings.membership.webhook.copySuccess'))
    } catch {
      toast.error(t('settings.membership.webhook.copyFailed'))
    }
  }

  return (
    <div className="w-full max-w-5xl">
      <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            {setupComplete ? (
              <CheckCircle2
                aria-hidden="true"
                className="size-5 text-emerald-600 dark:text-emerald-400"
              />
            ) : (
              <PlugZap aria-hidden="true" className="size-5 text-fg-muted" />
            )}
            <p className="text-sm font-medium text-fg">
              {setupComplete
                ? t('settings.membership.configuration.complete')
                : t('settings.membership.configuration.incomplete')}
            </p>
            <Badge size="sm" variant="soft">
              {completedCount}/{totalCount}
            </Badge>
          </div>
          <p className="mt-1.5 text-xs leading-5 text-fg-muted">
            {t('settings.membership.configuration.progress', {
              complete: completedCount,
              total: totalCount,
            })}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-sm text-fg">
          <span>{t('settings.membership.enable.label')}</span>
          <Toggle
            aria-label={t('settings.membership.enable.label')}
            checked={Boolean(props.value.enabled)}
            disabled={!setupComplete && !props.value.enabled}
            onCheckedChange={(enabled) => update('enabled', enabled)}
          />
        </div>
      </div>

      <section className="grid gap-5 border-b border-border py-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
        <GuideSectionHeading
          description={t('settings.membership.provider.description')}
          icon={PlugZap}
          title={t('settings.membership.provider.title')}
        />
        <div className="min-w-0 space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <SelectControl
              id="membership-provider"
              label={t('settings.membership.provider.label')}
              onChange={(value) => update('provider', value)}
              options={providerOptions}
              value={provider}
            />
            <SelectControl
              id="membership-environment"
              label={t('settings.membership.environment.label')}
              onChange={(value) => update('environment', value)}
              options={environmentOptions}
              value={environment}
            />
          </div>
          <p className="text-xs leading-5 text-fg-muted">
            {t('settings.membership.environment.description')}
          </p>
          {!providerSupported ? (
            <div className="flex items-start gap-2 border-l-2 border-amber-400 py-1 pl-3 text-xs leading-5 text-amber-700 dark:text-amber-300">
              <AlertTriangle
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              <p>
                {t('settings.membership.provider.notSupported', {
                  provider: providerLabel,
                })}
              </p>
            </div>
          ) : null}
          <SecretField
            configured={apiKeyConfigured}
            description={`${t('settings.membership.apiKey.description')} ${t('settings.membership.credential.keep')}`}
            keepHint={t('settings.membership.credential.configured')}
            label={t('settings.membership.apiKey.label')}
            onChange={(value) => update('apiKey', value)}
            placeholder={t('settings.membership.apiKey.placeholder')}
            value={props.value.apiKey ?? ''}
          />
        </div>
      </section>

      <section className="grid gap-5 border-b border-border py-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
        <div>
          <GuideSectionHeading
            description={t('settings.membership.products.description')}
            icon={PackageOpen}
            title={t('settings.membership.products.title')}
          />
          {provider === 'dodo' ? (
            <a
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
              href={DODO_SUBSCRIPTION_DOCS_URL}
              rel="noreferrer"
              target="_blank"
            >
              {t('settings.membership.products.docs')}
              <ExternalLink aria-hidden="true" className="size-3.5" />
            </a>
          ) : null}
        </div>
        <div className="grid min-w-0 gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <TextInput
              label={t('settings.membership.products.monthly.label')}
              onChange={(value) => update('monthlyProductId', value)}
              placeholder={t(
                'settings.membership.products.monthly.placeholder',
              )}
              value={props.value.monthlyProductId ?? ''}
            />
            <p className="text-xs leading-5 text-fg-muted">
              {t('settings.membership.products.monthly.description')}
            </p>
          </div>
          <div className="space-y-2">
            <TextInput
              label={t('settings.membership.products.yearly.label')}
              onChange={(value) => update('yearlyProductId', value)}
              placeholder={t('settings.membership.products.yearly.placeholder')}
              value={props.value.yearlyProductId ?? ''}
            />
            <p className="text-xs leading-5 text-fg-muted">
              {t('settings.membership.products.yearly.description')}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-5 pt-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
        <div>
          <GuideSectionHeading
            description={t('settings.membership.webhook.description')}
            icon={Webhook}
            title={t('settings.membership.webhook.title')}
          />
          {provider === 'dodo' ? (
            <a
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
              href={DODO_WEBHOOK_DOCS_URL}
              rel="noreferrer"
              target="_blank"
            >
              {t('settings.membership.webhook.docs')}
              <ExternalLink aria-hidden="true" className="size-3.5" />
            </a>
          ) : null}
        </div>

        <div className="min-w-0 space-y-5">
          <div className="space-y-2">
            <p className="text-sm font-medium text-fg">
              {t('settings.membership.webhook.endpointLabel')}
            </p>
            <div className="flex items-center gap-2 rounded-sm border border-border bg-surface-inset px-3 py-2">
              <code className="min-w-0 flex-1 break-all text-xs text-fg">
                {webhookUrl}
              </code>
              <Button
                aria-label={t('settings.membership.webhook.copyAria')}
                iconOnly
                onClick={() => void copyWebhookUrl()}
                type="button"
                variant="secondary"
              >
                <Copy aria-hidden="true" className="size-3.5" />
              </Button>
            </div>
            <p className="text-xs leading-5 text-fg-muted">
              {t('settings.membership.webhook.publicHint')}
            </p>
          </div>

          {provider === 'dodo' ? (
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-medium text-fg">
                  {t('settings.membership.webhook.eventsTitle')}
                </h4>
                <p className="mt-1 text-xs text-fg-muted">
                  {t('settings.membership.webhook.eventsDescription')}
                </p>
              </div>
              <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {MEMBERSHIP_WEBHOOK_EVENTS.map((event) => (
                  <li
                    className="flex items-center gap-2 text-xs text-fg-muted"
                    key={event}
                  >
                    <Check
                      aria-hidden="true"
                      className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                    />
                    <code>{event}</code>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex items-start gap-3">
            <KeyRound
              aria-hidden="true"
              className="mt-1 size-4 shrink-0 text-fg-muted"
            />
            <div className="min-w-0 flex-1">
              <SecretField
                configured={webhookKeyConfigured}
                description={`${t('settings.membership.webhook.signingKeyDescription')} ${t('settings.membership.credential.keep')}`}
                keepHint={t('settings.membership.credential.configured')}
                label={t('settings.membership.webhook.signingKeyLabel')}
                onChange={(value) => update('webhookSigningKey', value)}
                placeholder={t(
                  'settings.membership.webhook.signingKeyPlaceholder',
                )}
                value={props.value.webhookSigningKey ?? ''}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
