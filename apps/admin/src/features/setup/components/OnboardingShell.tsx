import { Check, ChevronDown, ChevronLeft } from 'lucide-react'
import type { PropsWithChildren, ReactNode } from 'react'

import { AuthScene } from '~/features/auth/entry/AuthExperience'
import { useI18n } from '~/i18n'
import type { TranslationKey } from '~/i18n/types'
import { Button } from '~/ui/primitives/button'
import { cn } from '~/utils/cn'

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
        'flex items-center gap-1.5 rounded-sm text-xs',
        props.item.key === 'welcome' && 'sr-only',
        props.sub && 'py-1',
        state === 'current' && 'font-medium text-accent',
        state === 'active' && 'font-medium text-accent',
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
            'inline-flex size-4 shrink-0 items-center justify-center rounded-full border text-xs leading-none',
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
  props: PropsWithChildren<{
    aside?: ReactNode
    onLater?: () => void
    step: OnboardingStep
  }>,
) {
  const { t } = useI18n()

  return (
    <AuthScene scene={props.step}>
      <section className="auth-entry__step">
        <nav
          aria-label={t('setup.onboarding.rail.label')}
          className={props.step === 'welcome' ? 'sr-only' : 'mb-7'}
        >
          <ol className="flex items-center justify-between gap-2">
            {railItems.map((item, index) => (
              <RailRow
                item={item}
                key={item.key}
                number={index || undefined}
                state={itemState(item, props.step)}
              />
            ))}
          </ol>
          <ol
            className={
              props.step.startsWith('ai-')
                ? 'mt-4 flex flex-wrap gap-x-4 gap-y-1 border-b border-border pb-2'
                : 'hidden'
            }
          >
            {railItems.flatMap((item) =>
              (item.children ?? []).map((child) => (
                <RailRow
                  item={child}
                  key={child.key}
                  state={itemState(child, props.step)}
                  sub
                />
              )),
            )}
          </ol>
        </nav>
        <p className="mb-3 text-xs font-medium tracking-widest text-accent">
          {
            {
              welcome: 'HELLO, YOUR NEW SPACE.',
              account: '01 / MAKE IT YOURS',
              site: '02 / A NAME, A LITTLE PERSONALITY',
              'ai-providers': '03 / A LITTLE HELP FOR YOUR IDEAS',
              'ai-models': '03 / THE RIGHT TOOL FOR EACH THOUGHT',
              'ai-features': '03 / JUST THE HELP YOU NEED',
              ready: 'ALL SET. ALL YOURS.',
            }[props.step]
          }
        </p>
        <div className="auth-entry__field">{props.children}</div>
        {props.aside ? (
          <details className="group mt-6 border-t border-border pt-3 text-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between text-fg-muted">
              {t('auth.entry.setupInfo')}
              <ChevronDown
                aria-hidden="true"
                className="size-3.5 transition-transform group-open:rotate-180"
              />
            </summary>
            <aside className="mt-3 rounded-md bg-surface-page p-3">
              {props.aside}
            </aside>
          </details>
        ) : null}
        {props.onLater ? (
          <button
            className="mt-4 flex h-8 items-center text-sm text-fg-subtle transition-colors hover:text-accent"
            onClick={props.onLater}
            type="button"
          >
            {t('setup.onboarding.action.later')}
          </button>
        ) : null}
      </section>
    </AuthScene>
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
    <section className="min-w-0">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-fg">
          {props.title}
        </h1>
        {props.description ? (
          <p className="mt-2 text-sm leading-6 text-fg-muted">
            {props.description}
          </p>
        ) : null}
      </header>
      <div>{props.children}</div>
      {props.footer ? (
        <footer className="mt-6 flex flex-wrap items-center justify-between gap-2">
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

export function OnboardingFooter(
  props: PropsWithChildren<{ meta?: ReactNode; onBack?: () => void }>,
) {
  const { t } = useI18n()
  return (
    <>
      {props.onBack ? (
        <Button onClick={props.onBack} type="button" variant="secondary">
          <ChevronLeft aria-hidden="true" className="size-4" />
          {t('setup.onboarding.action.back')}
        </Button>
      ) : (
        <span className="text-sm text-fg-muted">{props.meta}</span>
      )}
      <div className="flex items-center gap-2">{props.children}</div>
    </>
  )
}

export function FieldHint(props: PropsWithChildren) {
  return <p className="mt-1.5 text-sm text-fg-muted">{props.children}</p>
}
