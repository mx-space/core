import { Check } from 'lucide-react'
import type { PropsWithChildren, ReactNode } from 'react'

import { useI18n } from '~/i18n'
import type { TranslationKey } from '~/i18n/types'
import { authBackdropStyle } from '~/lib/auth-backdrop'
import { cn } from '~/utils/cn'

import faviconUrl from '../../../../favicon.png'
import type { OnboardingStep } from '../utils/onboarding'
import { onboardingSteps } from '../utils/onboarding'

export const deploymentDocsUrl = 'https://mx-space.js.org'

type RailState = 'active' | 'current' | 'done' | 'pending'

interface RailItem {
  children?: RailItem[]
  key: OnboardingStep | 'ai'
  labelKey: TranslationKey
}

const railItems: RailItem[] = [
  { key: 'welcome', labelKey: 'setup.onboarding.rail.welcome' },
  { key: 'account', labelKey: 'setup.onboarding.rail.account' },
  { key: 'site', labelKey: 'setup.onboarding.rail.site' },
  {
    children: [
      { key: 'ai-providers', labelKey: 'setup.onboarding.rail.aiProviders' },
      { key: 'ai-models', labelKey: 'setup.onboarding.rail.aiModels' },
      { key: 'ai-features', labelKey: 'setup.onboarding.rail.aiFeatures' },
    ],
    key: 'ai',
    labelKey: 'setup.onboarding.rail.ai',
  },
  { key: 'ready', labelKey: 'setup.onboarding.rail.ready' },
]

function stepIndex(step: OnboardingStep) {
  return onboardingSteps.indexOf(step)
}

function itemState(item: RailItem, current: OnboardingStep): RailState {
  if (item.children) {
    const states = item.children.map((child) => itemState(child, current))
    if (states.every((state) => state === 'done')) return 'done'
    if (states.every((state) => state === 'pending')) return 'pending'
    return 'active'
  }
  const index = stepIndex(item.key as OnboardingStep)
  const currentIndex = stepIndex(current)
  if (index < currentIndex) return 'done'
  if (index === currentIndex) return 'current'
  return 'pending'
}

function RailRow(props: {
  item: RailItem
  number?: number
  state: RailState
  sub?: boolean
}) {
  const { t } = useI18n()
  const { state } = props
  return (
    <li
      aria-current={state === 'current' ? 'step' : undefined}
      className={cn(
        'flex h-8 items-center gap-2 rounded-sm px-3 text-sm',
        props.sub && 'pl-9',
        state === 'current' && 'bg-black/[0.04] font-medium text-fg',
        state === 'active' && 'font-medium text-fg',
        state === 'done' && 'text-fg',
        state === 'pending' && 'text-fg-muted',
      )}
      data-state={state}
      data-step={props.item.key}
    >
      {props.number ? (
        <span
          aria-hidden="true"
          className={cn(
            'inline-flex size-4 shrink-0 items-center justify-center rounded-full border text-[10px] leading-none',
            state === 'done'
              ? 'border-accent bg-accent text-white'
              : state === 'pending'
                ? 'border-border-strong text-fg-muted'
                : 'border-accent text-accent',
          )}
        >
          {state === 'done' ? (
            <Check className="size-2.5" strokeWidth={3} />
          ) : (
            props.number
          )}
        </span>
      ) : null}
      {t(props.item.labelKey)}
    </li>
  )
}

export function OnboardingShell(
  props: PropsWithChildren<{ aside?: ReactNode; step: OnboardingStep }>,
) {
  const { t } = useI18n()

  return (
    <div
      className="auth-light flex min-h-dvh flex-wrap bg-white text-fg"
      style={authBackdropStyle}
    >
      <nav
        aria-label={t('setup.onboarding.rail.label')}
        className="flex w-full flex-col gap-5 border-b border-border bg-surface-page/70 px-3 py-5 md:w-60 md:border-r md:border-b-0"
      >
        <div className="flex items-center gap-2 px-3 text-base font-semibold">
          <img alt="" className="size-6 rounded-md" src={faviconUrl} />
          Mix Space
        </div>
        <ol className="flex flex-wrap gap-0.5 md:flex-col">
          {railItems.flatMap((item, index) => [
            <RailRow
              item={item}
              key={item.key}
              number={index + 1}
              state={itemState(item, props.step)}
            />,
            ...(item.children ?? []).map((child) => (
              <RailRow
                item={child}
                key={child.key}
                state={itemState(child, props.step)}
                sub
              />
            )),
          ])}
        </ol>
        <a
          className="mt-auto hidden px-3 text-sm text-accent hover:text-accent-hover md:block"
          href={deploymentDocsUrl}
          rel="noreferrer"
          target="_blank"
        >
          {t('setup.onboarding.rail.docs')}
        </a>
      </nav>
      <main className="flex min-w-0 flex-1 justify-center px-4 py-6 md:px-12 md:py-16">
        <div className="flex w-full max-w-[940px] flex-wrap items-start gap-6">
          {props.children}
          {props.aside ? (
            <aside className="min-w-0 flex-[1_1_260px] rounded-lg border border-border bg-white/65 p-4 md:max-w-80">
              {props.aside}
            </aside>
          ) : null}
        </div>
      </main>
    </div>
  )
}

export function OnboardingCard(
  props: PropsWithChildren<{
    description?: ReactNode
    footer?: ReactNode
    title: ReactNode
  }>,
) {
  return (
    <section className="min-w-0 flex-[1_1_440px] rounded-lg border border-border bg-surface-card shadow-sm md:max-w-[580px]">
      <header className="border-b border-border px-6 py-5">
        <h1 className="text-2xl font-semibold text-fg">{props.title}</h1>
        {props.description ? (
          <p className="mt-1 text-sm text-fg-muted">{props.description}</p>
        ) : null}
      </header>
      <div className="px-6 py-5">{props.children}</div>
      {props.footer ? (
        <footer className="flex items-center justify-end gap-2 rounded-b-lg border-t border-border bg-surface-page px-6 py-3">
          {props.footer}
        </footer>
      ) : null}
    </section>
  )
}

export function OnboardingAsideTitle(props: PropsWithChildren) {
  return (
    <p className="mb-3 text-sm font-medium text-fg-muted">{props.children}</p>
  )
}
