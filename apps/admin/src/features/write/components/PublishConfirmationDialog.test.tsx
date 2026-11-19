import { act, createElement } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { PublishAiResourceRequest } from '~/api/publish-jobs'
import type { AIConfig } from '~/features/settings/types/settings'
import { I18nProvider } from '~/i18n'

import { PublishConfirmationDialog } from './PublishConfirmationDialog'

const SUMMARY = '摘要'
const INSIGHTS = '精读'

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
            contentChanged: true,
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

  it('submits per-resource modes and pre-fills the remembered choice', async () => {
    const onConfirm = vi.fn()
    const props = {
      aiConfig: {
        enableInsights: true,
        enableSummary: true,
        enableTranslation: true,
        translationTargetLanguages: ['en'],
        tts: { enable: true },
      } as any,
      contentChanged: true,
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
    const render = (
      open: boolean,
      rememberedResources?: PublishAiResourceRequest[],
    ) =>
      act(() => {
        root.render(
          createElement(
            I18nProvider,
            null,
            createElement(PublishConfirmationDialog, {
              ...props,
              open,
              rememberedResources,
            }),
          ),
        )
      })
    const tab = (resource: string, label: string) =>
      [
        ...document.querySelectorAll<HTMLElement>(
          `[role="tablist"][aria-label="${resource}"] [role="tab"]`,
        ),
      ].find((item) => item.textContent?.trim() === label)!

    render(true)

    expect(document.body.textContent).toContain(
      '提交后将直接更新当前线上文章。',
    )
    expect(tab(SUMMARY, '不生成').getAttribute('aria-selected')).toBe('true')

    await act(async () => {
      tab(SUMMARY, '上线前').click()
      tab(INSIGHTS, '上线后').click()
      await Promise.resolve()
    })
    act(() => {
      ;[...document.querySelectorAll('button')]
        .find((button) => button.textContent?.trim() === '更新线上文章')
        ?.click()
    })
    expect(onConfirm).toHaveBeenCalledWith({
      aiResources: [
        { mode: 'sync', resource: 'summary' },
        { mode: 'async', resource: 'insights' },
      ],
      rememberAiResources: true,
    })

    render(false)
    render(true, [
      { mode: 'sync', resource: 'summary' },
      { mode: 'async', resource: 'insights' },
    ])

    expect(tab(SUMMARY, '上线前').getAttribute('aria-selected')).toBe('true')
    expect(tab(INSIGHTS, '上线后').getAttribute('aria-selected')).toBe('true')
  })

  it('skips AI for a metadata-only update without touching the remembered choices', () => {
    const onConfirm = vi.fn()
    // Fixture: the dialog only reads the enable flags.
    const aiConfig = { enableSummary: true } as unknown as AIConfig
    act(() => {
      root.render(
        createElement(
          I18nProvider,
          null,
          createElement(PublishConfirmationDialog, {
            aiConfig,
            contentChanged: false,
            contentFormat: 'markdown',
            diverged: false,
            kind: 'post',
            onClose: vi.fn(),
            onConfirm,
            otherBranchCount: 0,
            open: true,
            operation: 'online-update',
            pending: false,
            rememberedResources: [{ mode: 'sync', resource: 'summary' }],
            validationError: null,
          }),
        ),
      )
    })
    const submit = () =>
      act(() => {
        ;[...document.querySelectorAll('button')]
          .find((button) => button.textContent?.trim() === '更新线上文章')
          ?.click()
      })
    const skipSwitch = () =>
      document.querySelector<HTMLElement>('[role="switch"]')!

    expect(skipSwitch().getAttribute('aria-checked')).toBe('true')
    expect(document.querySelector(`[aria-label="${SUMMARY}"]`)).toBeNull()
    submit()
    expect(onConfirm).toHaveBeenLastCalledWith({
      aiResources: [],
      rememberAiResources: false,
    })

    act(() => skipSwitch().closest('label')!.click())
    expect(skipSwitch().getAttribute('aria-checked')).toBe('false')
    expect(
      document
        .querySelector(`[aria-label="${SUMMARY}"] [aria-selected="true"]`)
        ?.textContent?.trim(),
    ).toBe('上线前')
    submit()
    expect(onConfirm).toHaveBeenLastCalledWith({
      aiResources: [{ mode: 'sync', resource: 'summary' }],
      rememberAiResources: true,
    })
  })
})
