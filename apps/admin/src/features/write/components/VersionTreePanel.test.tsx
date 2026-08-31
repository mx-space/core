import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, createElement } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getDraftRevisions } from '~/api/drafts'
import { I18nProvider } from '~/i18n'
import type {
  ContentRevision,
  DraftModel,
  VersionTreeNode,
} from '~/models/draft'
import { DraftRefType } from '~/models/draft'

import { VersionTreePanel } from './VersionTreePanel'

vi.mock('~/api/drafts', () => ({ getDraftRevisions: vi.fn() }))

const at = '2026-08-31T00:00:00.000Z'
const revision = (
  id: string,
  parentRevisionId: string | null,
  title: string,
): ContentRevision => ({
  content: null,
  contentFormat: 'markdown',
  createdAt: at,
  documentId: 'document-1',
  id,
  images: null,
  meta: null,
  parentRevisionId,
  text: title,
  title,
  typeSpecificData: null,
})
const rootRevision = revision('revision-root', null, 'Initial publication')
const onlineRevision = revision(
  'revision-online',
  rootRevision.id,
  'Current online article',
)
const draftRevision = revision(
  'revision-draft',
  'revision-autosave',
  'Draft branch article',
)
const branch = (
  id: string,
  headRevision: ContentRevision,
  baseRevision: ContentRevision = rootRevision,
): DraftModel => ({
  baseRevision,
  baseRevisionId: baseRevision.id,
  commonAncestorRevisionId: baseRevision.id,
  createdAt: at,
  document: {
    createdAt: at,
    id: 'document-1',
    publishedRevisionId: onlineRevision.id,
    refId: 'post-1',
    refType: DraftRefType.Post,
    updatedAt: at,
  },
  documentId: 'document-1',
  headRevision,
  headRevisionId: headRevision.id,
  id,
  publishedRevision: onlineRevision,
  relationToPublished: 'diverged',
  status: 'active',
  updatedAt: at,
})

const branchA = branch('branch-a', draftRevision)
const branchBRevision = revision(
  'revision-branch-b',
  onlineRevision.id,
  'Second draft branch',
)
const branchB = branch('branch-b', branchBRevision, onlineRevision)
const branchCRevision = revision(
  'revision-branch-c',
  draftRevision.id,
  'Nested draft branch',
)
const branchC = branch('branch-c', branchCRevision, draftRevision)

const nodes: VersionTreeNode[] = [
  {
    branchBaseIds: [branchA.id],
    branchHeadIds: [],
    collapsedRevisionCount: 0,
    parentNodeId: null,
    publishedAt: at,
    revision: rootRevision,
  },
  {
    branchBaseIds: [branchB.id],
    branchHeadIds: [],
    collapsedRevisionCount: 0,
    parentNodeId: rootRevision.id,
    publishedAt: at,
    revision: onlineRevision,
  },
  {
    branchBaseIds: [branchC.id],
    branchHeadIds: [branchA.id],
    collapsedRevisionCount: 1,
    parentNodeId: rootRevision.id,
    publishedAt: null,
    revision: draftRevision,
  },
  {
    branchBaseIds: [],
    branchHeadIds: [branchB.id],
    collapsedRevisionCount: 0,
    parentNodeId: onlineRevision.id,
    publishedAt: null,
    revision: branchBRevision,
  },
  {
    branchBaseIds: [],
    branchHeadIds: [branchC.id],
    collapsedRevisionCount: 0,
    parentNodeId: draftRevision.id,
    publishedAt: null,
    revision: branchCRevision,
  },
]

let container: HTMLDivElement
let root: Root
let queryClient: QueryClient

beforeEach(() => {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  vi.mocked(getDraftRevisions).mockResolvedValue([
    draftRevision,
    revision('revision-autosave', rootRevision.id, 'Intermediate autosave'),
    rootRevision,
  ])
})

afterEach(() => {
  act(() => root.unmount())
  queryClient.clear()
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

describe('VersionTreePanel', () => {
  it('renders the version graph, previews on selection, and switches only through continue', async () => {
    const onCompare = vi.fn()
    const onContinue = vi.fn()
    await act(async () => {
      root.render(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(
            I18nProvider,
            null,
            createElement(VersionTreePanel, {
              currentDraftId: branchA.id,
              currentPublishedRevisionId: onlineRevision.id,
              deletingDraftId: null,
              drafts: [branchA, branchB, branchC],
              nodes,
              onClose: vi.fn(),
              onCompare,
              onContinue,
              onDelete: vi.fn(),
              onHistory: vi.fn(),
              onPublish: vi.fn(),
              onViewOnline: vi.fn(),
            }),
          ),
        ),
      )
      await Promise.resolve()
    })

    expect(document.body.textContent).toContain('版本与草稿')
    expect(document.body.textContent).toContain('当前线上')
    expect(document.body.textContent).toContain('当前正在编辑')
    expect(document.body.textContent).toContain('Initial publication')
    expect(document.body.textContent).not.toContain('Second draft branch')
    expect(document.body.textContent).not.toContain('branch-a')

    const graph = document.querySelector('ol[aria-label="版本关系图"]')!
    expect(graph.children).toHaveLength(5)
    for (const row of graph.children) {
      const gutter = Number.parseFloat(
        (row as HTMLElement).style.gridTemplateColumns,
      )
      expect(gutter).toBeGreaterThan(0)
      expect(row.querySelector('[aria-hidden="true"] > span')).not.toBeNull()
    }

    act(() => {
      ;[...document.querySelectorAll('button')]
        .find((button) => button.textContent?.includes('当前正在编辑'))
        ?.click()
    })
    expect(onCompare).toHaveBeenCalledWith(branchA)
    expect(onContinue).not.toHaveBeenCalled()

    const currentCard = document
      .querySelector('button[aria-current="true"]')
      ?.closest('article')
    act(() => {
      ;[...(currentCard?.querySelectorAll('button') ?? [])]
        .find((button) => button.textContent?.trim() === '继续编辑')
        ?.click()
    })
    expect(onContinue).toHaveBeenCalledWith(branchA)

    await act(async () => {
      ;[...document.querySelectorAll('button')]
        .find((button) => button.textContent?.includes('1 次自动保存'))
        ?.click()
      await Promise.resolve()
    })
    expect(getDraftRevisions).toHaveBeenCalledWith(branchA.id)
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain('Intermediate autosave')
    })
  })
})
