import { act } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'

import { I18nProvider } from '~/i18n'

import { OnboardingCard, OnboardingShell } from './OnboardingShell'

let root: Root | null = null
let container: HTMLDivElement | null = null

function render(node: React.ReactNode) {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  act(() => {
    root!.render(<I18nProvider>{node}</I18nProvider>)
  })
  return container
}

afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
  root = null
  container = null
})

describe('OnboardingShell', () => {
  it('marks earlier steps done, the current step current and the rest pending', () => {
    const el = render(
      <OnboardingShell aside={<p>aside</p>} step="ai-models">
        <OnboardingCard title="Models">body</OnboardingCard>
      </OnboardingShell>,
    )

    const state = (step: string) =>
      el.querySelector(`[data-step="${step}"]`)?.getAttribute('data-state')

    expect(state('welcome')).toBe('done')
    expect(state('site')).toBe('done')
    expect(state('ai')).toBe('active')
    expect(state('ai-providers')).toBe('done')
    expect(state('ai-models')).toBe('current')
    expect(state('ai-features')).toBe('pending')
    expect(state('ready')).toBe('pending')
    expect(
      el.querySelector('[aria-current="step"]')?.getAttribute('data-step'),
    ).toBe('ai-models')
  })

  it('renders the card title, body, footer and the aside', () => {
    const el = render(
      <OnboardingShell aside={<p>aside text</p>} step="site">
        <OnboardingCard
          description="desc"
          footer={<button type="button">next</button>}
          title="Your site"
        >
          body text
        </OnboardingCard>
      </OnboardingShell>,
    )

    expect(el.querySelector('h1')?.textContent).toBe('Your site')
    expect(el.textContent).toContain('desc')
    expect(el.textContent).toContain('body text')
    expect(el.querySelector('footer button')?.textContent).toBe('next')
    expect(el.querySelector('aside')?.textContent).toBe('aside text')
  })
})
