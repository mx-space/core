import { act, createElement } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '~/i18n'

import { PublishConfirmationDialog } from './PublishConfirmationDialog'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  document.body.innerHTML = ''
})

describe('PublishConfirmationDialog', () => {
  it('offers the three-way diff before publishing a diverged branch', () => {
    const onReviewDiff = vi.fn()
    act(() => {
      root.render(
        createElement(
          I18nProvider,
          null,
          createElement(PublishConfirmationDialog, {
            contentFormat: 'markdown',
            diverged: true,
            kind: 'post',
            onClose: vi.fn(),
            onConfirm: vi.fn(),
            onReviewDiff,
            otherBranchCount: 2,
            open: true,
            operation: 'online-update',
            pending: false,
            validationError: null,
          }),
        ),
      )
    })

    act(() => {
      ;[...document.querySelectorAll('button')]
        .find((button) => button.textContent?.trim() === '查看差异')
        ?.click()
    })
    expect(onReviewDiff).toHaveBeenCalledOnce()
  })

  it('uses one-time empty AI selections for an online update', async () => {
    const onConfirm = vi.fn()
    const props = {
      aiConfig: {
        enableInsights: true,
        enableSummary: true,
        enableTranslation: true,
        translationTargetLanguages: ['en'],
        tts: { enable: true },
      } as any,
      contentFormat: 'lexical' as const,
      diverged: false,
      kind: 'post' as const,
      onClose: vi.fn(),
      onConfirm,
      otherBranchCount: 0,
      open: true,
      operation: 'online-update' as const,
      pending: false,
      savedAt: '刚刚',
      validationError: null,
    }

    act(() => {
      root.render(
        createElement(
          I18nProvider,
          null,
          createElement(PublishConfirmationDialog, props),
        ),
      )
    })

    expect(document.body.textContent).toContain(
      '提交后将直接更新当前线上文章。',
    )
    const checkboxes = [
      ...document.querySelectorAll<HTMLElement>('[role="checkbox"]'),
    ]
    expect(checkboxes).toHaveLength(4)
    expect(
      checkboxes.every((item) => item.getAttribute('aria-checked') === 'false'),
    ).toBe(true)

    await act(async () => {
      checkboxes[0].closest('label')?.click()
      await Promise.resolve()
    })
    expect(checkboxes[0].getAttribute('aria-checked')).toBe('true')
    act(() => {
      ;[...document.querySelectorAll('button')]
        .find((button) => button.textContent?.trim() === '更新线上文章')
        ?.click()
    })
    expect(onConfirm).toHaveBeenCalledWith(['summary'])

    act(() => {
      root.render(
        createElement(
          I18nProvider,
          null,
          createElement(PublishConfirmationDialog, { ...props, open: false }),
        ),
      )
    })
    act(() => {
      root.render(
        createElement(
          I18nProvider,
          null,
          createElement(PublishConfirmationDialog, props),
        ),
      )
    })

    expect(
      [...document.querySelectorAll<HTMLElement>('[role="checkbox"]')].every(
        (item) => item.getAttribute('aria-checked') === 'false',
      ),
    ).toBe(true)
  })
})
