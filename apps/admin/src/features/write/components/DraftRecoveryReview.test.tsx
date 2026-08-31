import { act, createElement } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '~/i18n'

import { DraftRecoveryReview } from './DraftRecoveryReview'

vi.mock('~/features/drafts/components/MarkdownDraftDiffPanel', () => ({
  MarkdownDraftDiffPanel: (props: {
    currentText: string
    selectedText: string
  }) => (
    <div data-testid="markdown-recovery-diff">
      {props.selectedText} → {props.currentText}
    </div>
  ),
}))

vi.mock('~/features/drafts/components/RichDraftDiffPanel', () => ({
  RichDraftDiffPanel: () => <div data-testid="rich-recovery-diff" />,
}))

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

describe('DraftRecoveryReview', () => {
  it('compares the article with the latest draft without loading it first', () => {
    const onContinue = vi.fn()
    const onDelete = vi.fn()

    act(() => {
      root.render(
        createElement(
          I18nProvider,
          null,
          createElement(DraftRecoveryReview, {
            data: {
              bodyChanged: true,
              diverged: false,
              currentText: 'current article body',
              draftText: 'latest draft body',
              fields: [
                {
                  current: 'Current title',
                  draft: 'Draft title',
                  label: '标题',
                },
              ],
              rich: false,
              savedAt: '刚刚',
            },
            onClose: vi.fn(),
            onContinue,
            onDelete,
            open: true,
          }),
        ),
      )
    })

    expect(document.body.textContent).toContain('Current title')
    expect(document.body.textContent).toContain('Draft title')
    expect(
      document.querySelector('[data-testid="markdown-recovery-diff"]')
        ?.textContent,
    ).toContain('current article body → latest draft body')
    expect(document.body.textContent).not.toMatch(/v\d+/)

    const buttons = [...document.querySelectorAll('button')]
    act(() => {
      buttons
        .find((button) => button.textContent?.includes('继续编辑草稿'))
        ?.click()
      buttons
        .find((button) => button.textContent?.includes('删除草稿'))
        ?.click()
    })

    expect(onContinue).toHaveBeenCalledOnce()
    expect(onDelete).toHaveBeenCalledOnce()
  })

  it('shows separate ancestor-to-online and ancestor-to-draft diffs', () => {
    act(() => {
      root.render(
        createElement(
          I18nProvider,
          null,
          createElement(DraftRecoveryReview, {
            data: {
              ancestorText: 'shared ancestor',
              bodyChanged: true,
              currentText: 'online change',
              diverged: true,
              draftText: 'branch change',
              fields: [
                {
                  ancestor: 'Ancestor title',
                  current: 'Online title',
                  draft: 'Branch title',
                  label: '标题',
                },
              ],
              rich: false,
              savedAt: '刚刚',
            },
            onClose: vi.fn(),
            onContinue: vi.fn(),
            onDelete: vi.fn(),
            open: true,
          }),
        ),
      )
    })

    const diffs = [
      ...document.querySelectorAll('[data-testid="markdown-recovery-diff"]'),
    ].map((node) => node.textContent)
    expect(diffs).toEqual([
      'shared ancestor → online change',
      'shared ancestor → branch change',
    ])
    expect(document.body.textContent).toContain('Ancestor title')
  })
})
