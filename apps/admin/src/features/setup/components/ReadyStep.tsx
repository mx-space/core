import { useQuery } from '@tanstack/react-query'
import { Download, Link2, PenLine } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { getOption, getOwner } from '~/api/options'
import { useI18n } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'
import { Button } from '~/ui/primitives/button'

import { useOnboardingAiConfig } from '../hooks/use-onboarding-ai'
import { onboardingLanguages } from '../utils/onboarding'
import {
  deploymentDocsUrl,
  OnboardingAsideTitle,
  OnboardingCard,
  OnboardingFooter,
  OnboardingShell,
} from './OnboardingShell'

const nextActionClassName =
  'flex items-center gap-3 rounded-md border border-border bg-surface-card px-3 py-2.5 text-fg shadow-xs transition-colors hover:bg-surface-page'

export function ReadyStep(props: { onFinish: () => void }) {
  const { t } = useI18n()
  const ownerQuery = useQuery({
    queryFn: getOwner,
    queryKey: adminQueryKeys.onboarding.owner(),
  })
  const seoQuery = useQuery({
    queryFn: () => getOption<{ title?: string }>('seo'),
    queryKey: adminQueryKeys.onboarding.seo(),
  })
  const aiQuery = useOnboardingAiConfig()
  const siteName = seoQuery.data?.title || 'Mix Space'
  const ai = aiQuery.data
  const separator = t('setup.onboarding.ready.separator')

  const enabledFeatures = [
    ai?.enableTranslation && t('setup.onboarding.ai.features.translation'),
    ai?.enableSummary && t('setup.onboarding.ai.features.summary'),
    ai?.enableInsights && t('setup.onboarding.ai.features.insights'),
    ai?.tts?.enable && t('setup.onboarding.ai.features.tts'),
  ].filter(Boolean)
  const providerNames = (ai?.providers ?? []).map((provider) => provider.name)
  const aiSummary = providerNames.length
    ? [providerNames.join(separator), enabledFeatures.join(separator)]
        .filter(Boolean)
        .join(' · ')
    : ''
  const languages = (ai?.translationTargetLanguages ?? [])
    .map(
      (code) =>
        onboardingLanguages.find((language) => language.code === code)?.label ??
        code,
    )
    .join(separator)

  const summaryRows = [
    {
      href: '/setting/user',
      label: t('setup.onboarding.ready.account'),
      value: ownerQuery.data?.username,
    },
    {
      href: '/setting/site',
      label: t('setup.onboarding.ready.site'),
      value: seoQuery.data?.title,
    },
    {
      href: '/setting/ai',
      label: t('setup.onboarding.ready.ai'),
      value: aiSummary,
    },
    {
      href: '/setting/ai',
      label: t('setup.onboarding.ready.languages'),
      value: ai?.enableTranslation ? languages : '',
    },
  ]

  return (
    <OnboardingShell
      aside={
        <>
          <OnboardingAsideTitle>
            {t('setup.onboarding.ready.asideTitle')}
          </OnboardingAsideTitle>
          <div className="grid grid-cols-[max-content_minmax(0,1fr)_max-content] items-center gap-x-3 gap-y-2.5 text-sm">
            {summaryRows.map((row) => (
              <SummaryRow key={row.label} {...row} />
            ))}
          </div>
        </>
      }
      step="ready"
    >
      <OnboardingCard
        description={t('setup.onboarding.ready.description', {
          name: siteName,
        })}
        footer={
          <OnboardingFooter>
            <Button
              data-testid="onboarding-submit"
              onClick={props.onFinish}
              type="button"
            >
              {t('setup.onboarding.ready.enter')}
            </Button>
          </OnboardingFooter>
        }
        title={t('setup.onboarding.ready.title')}
      >
        <div className="flex flex-col gap-2">
          <Link className={nextActionClassName} to="/posts/edit">
            <NextAction
              hint={t('setup.onboarding.ready.writeHint')}
              icon={<PenLine className="size-3.5" />}
              title={t('setup.onboarding.ready.write')}
            />
          </Link>
          <a
            className={nextActionClassName}
            href={deploymentDocsUrl}
            rel="noreferrer"
            target="_blank"
          >
            <NextAction
              hint={t('setup.onboarding.ready.themeHint')}
              icon={<Link2 className="size-3.5" />}
              title={t('setup.onboarding.ready.theme')}
            />
          </a>
          <Link className={nextActionClassName} to="/maintenance/backup">
            <NextAction
              hint={t('setup.onboarding.ready.importHint')}
              icon={<Download className="size-3.5" />}
              title={t('setup.onboarding.ready.import')}
            />
          </Link>
        </div>
      </OnboardingCard>
    </OnboardingShell>
  )
}

function NextAction(props: { hint: string; icon: ReactNode; title: string }) {
  return (
    <>
      <span className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-accent-soft text-accent">
        {props.icon}
      </span>
      <span className="min-w-0 text-sm">
        <span className="block font-medium">{props.title}</span>
        <span className="block text-fg-muted">{props.hint}</span>
      </span>
    </>
  )
}

function SummaryRow(props: { href: string; label: string; value?: string }) {
  const { t } = useI18n()
  return (
    <>
      <span className="text-fg-muted">{props.label}</span>
      <span className={props.value ? 'truncate text-fg' : 'text-fg-subtle'}>
        {props.value || t('setup.onboarding.ready.notSet')}
      </span>
      <Link className="text-accent hover:text-accent-hover" to={props.href}>
        {t('setup.onboarding.ready.edit')}
      </Link>
    </>
  )
}
