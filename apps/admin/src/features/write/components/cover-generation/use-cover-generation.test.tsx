import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query'
import { act, createElement } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiRequestError } from '~/api/http'
import { I18nProvider } from '~/i18n'
import { adminQueryKeys } from '~/query/keys'

import { useCoverGeneration } from './use-cover-generation'

const {
  draftImagePromptMock,
  generateImageMock,
  getImageModelsMock,
  getImagePresetsMock,
} = vi.hoisted(() => ({
  draftImagePromptMock: vi.fn(),
  generateImageMock: vi.fn(),
  getImageModelsMock: vi.fn(),
  getImagePresetsMock: vi.fn(),
}))

vi.mock('~/api/ai-image', () => ({
  draftImagePrompt: draftImagePromptMock,
  generateImage: generateImageMock,
  getImageModels: getImageModelsMock,
  getImagePresets: getImagePresetsMock,
  resolveImageTaskOutcome: vi.fn().mockReturnValue({ status: 'pending' }),
}))

vi.mock('~/api/tasks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('~/api/tasks')>()
  return {
    ...actual,
    getTask: vi.fn().mockResolvedValue({ id: 'task-x', status: 'running' }),
  }
})

vi.mock('~/features/tasks/hooks/useTaskSubscription', () => ({
  useTaskDetailSubscription: () => ({ socketConnected: false }),
}))

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return { ...actual, useQuery: vi.fn(actual.useQuery) }
})

interface Harness {
  container: HTMLDivElement
  root: Root
  unmount: () => void
}

function mount(): Harness {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  return {
    container,
    root,
    unmount: () => {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }
}

let latest: ReturnType<typeof useCoverGeneration> | undefined

function Probe(props: Parameters<typeof useCoverGeneration>[0]) {
  latest = useCoverGeneration(props)
  return null
}

function renderProbe(
  harness: Harness,
  client: QueryClient,
  props: Parameters<typeof useCoverGeneration>[0],
) {
  act(() => {
    harness.root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(I18nProvider, null, createElement(Probe, props)),
      ),
    )
  })
}

async function flush() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

function baseProps(
  overrides: Partial<Parameters<typeof useCoverGeneration>[0]> = {},
): Parameters<typeof useCoverGeneration>[0] {
  return {
    currentCover: '',
    enabled: true,
    onSelectCover: vi.fn(),
    refId: 'article-1',
    summary: 'a summary',
    text: 'the body',
    title: 'a title',
    ...overrides,
  }
}

let harness: Harness
let client: QueryClient

beforeEach(() => {
  harness = mount()
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  latest = undefined
  draftImagePromptMock.mockReset()
  generateImageMock.mockReset()
  getImageModelsMock.mockReset().mockResolvedValue([])
  getImagePresetsMock.mockReset().mockResolvedValue([
    {
      defaultAspectRatio: '16:9',
      id: 'signal-geometry',
      label: 'Signal Geometry',
    },
  ])
})

afterEach(() => {
  harness.unmount()
  document.body.innerHTML = ''
})

describe('useCoverGeneration mode transitions', () => {
  it('opening the drawer does not call draft-prompt and defaults to preset mode', async () => {
    renderProbe(harness, client, baseProps())
    await flush()

    act(() => {
      latest!.openDrawer()
    })
    await flush()

    expect(latest!.open).toBe(true)
    expect(latest!.mode).toBe('preset')
    expect(draftImagePromptMock).not.toHaveBeenCalled()
  })

  it('onViewEditPrompt compiles via draft-prompt and switches to manual mode on success', async () => {
    draftImagePromptMock.mockResolvedValueOnce({
      prompt: 'Compiled prompt text',
      recipe: {},
    })
    renderProbe(harness, client, baseProps())
    await flush()

    act(() => {
      latest!.openDrawer()
    })
    await flush()
    expect(latest!.presetId).toBe('signal-geometry')

    act(() => {
      latest!.onViewEditPrompt()
    })
    await flush()

    expect(draftImagePromptMock.mock.calls[0][0]).toEqual({
      presetId: 'signal-geometry',
      refId: 'article-1',
    })
    expect(latest!.mode).toBe('manual')
    expect(latest!.promptText).toBe('Compiled prompt text')
  })

  it('surfaces writerProviderMissing and stays in preset mode when draft-prompt fails with AI_NOT_ENABLED', async () => {
    draftImagePromptMock.mockRejectedValueOnce(
      new ApiRequestError('no text provider configured', 'AI_NOT_ENABLED'),
    )
    renderProbe(harness, client, baseProps())
    await flush()
    act(() => {
      latest!.openDrawer()
    })
    await flush()

    act(() => {
      latest!.onViewEditPrompt()
    })
    await flush()

    expect(latest!.mode).toBe('preset')
    expect(latest!.writerProviderMissing).toBe(true)
  })

  it('onWriteManually enters manual mode with an empty prompt without compiling', async () => {
    renderProbe(harness, client, baseProps())
    await flush()
    act(() => {
      latest!.openDrawer()
    })
    await flush()

    act(() => {
      latest!.onWriteManually()
    })
    await flush()

    expect(draftImagePromptMock).not.toHaveBeenCalled()
    expect(latest!.mode).toBe('manual')
    expect(latest!.promptText).toBe('')
  })

  it('onUsePreset clears the prompt and returns to preset mode', async () => {
    draftImagePromptMock.mockResolvedValueOnce({
      prompt: 'Compiled prompt text',
      recipe: {},
    })
    renderProbe(harness, client, baseProps())
    await flush()
    act(() => {
      latest!.openDrawer()
    })
    await flush()
    act(() => {
      latest!.onViewEditPrompt()
    })
    await flush()
    expect(latest!.mode).toBe('manual')

    act(() => {
      latest!.onUsePreset()
    })
    await flush()

    expect(latest!.mode).toBe('preset')
    expect(latest!.promptText).toBe('')
  })

  it('preset-mode generate enqueues without a prompt field', async () => {
    generateImageMock.mockResolvedValueOnce({ created: true, taskId: 'task-1' })
    renderProbe(harness, client, baseProps())
    await flush()
    act(() => {
      latest!.openDrawer()
    })
    await flush()
    expect(latest!.canGenerate).toBe(true)

    act(() => {
      latest!.onGenerate()
    })
    await flush()

    expect(generateImageMock).toHaveBeenCalledTimes(1)
    const payload = generateImageMock.mock.calls[0][0]
    expect(payload.prompt).toBeUndefined()
    expect(payload.presetId).toBe('signal-geometry')
    expect(payload.refId).toBe('article-1')
  })

  it('the task-status poll keeps running while the tab is backgrounded (refetchIntervalInBackground)', async () => {
    generateImageMock.mockResolvedValueOnce({ created: true, taskId: 'task-1' })
    renderProbe(harness, client, baseProps())
    await flush()
    act(() => {
      latest!.openDrawer()
    })
    await flush()

    act(() => {
      latest!.onGenerate()
    })
    await flush()

    const taskDetailKey = adminQueryKeys.tasks.taskDetail('task-1')
    const call = vi
      .mocked(useQuery)
      .mock.calls.find(
        ([options]) =>
          JSON.stringify((options as { queryKey?: unknown }).queryKey) ===
          JSON.stringify(taskDetailKey),
      )

    expect(call).toBeDefined()
    const [options] = call!
    expect(
      (options as { refetchIntervalInBackground?: boolean })
        .refetchIntervalInBackground,
    ).toBe(true)
  })

  it('preset mode without a refId disables generate until switched to manual', async () => {
    renderProbe(harness, client, baseProps({ refId: undefined }))
    await flush()
    act(() => {
      latest!.openDrawer()
    })
    await flush()

    expect(latest!.canGenerate).toBe(false)
    expect(latest!.presetNeedsSavedArticle).toBe(true)
  })

  it('manual-mode generate sends the edited prompt text', async () => {
    generateImageMock.mockResolvedValueOnce({ created: true, taskId: 'task-2' })
    renderProbe(harness, client, baseProps())
    await flush()
    act(() => {
      latest!.openDrawer()
    })
    await flush()
    act(() => {
      latest!.onWriteManually()
    })
    await flush()
    act(() => {
      latest!.setPromptText('a hand-written prompt')
    })
    await flush()

    act(() => {
      latest!.onGenerate()
    })
    await flush()

    expect(generateImageMock).toHaveBeenCalledTimes(1)
    const payload = generateImageMock.mock.calls[0][0]
    expect(payload.prompt).toBe('a hand-written prompt')
  })

  it('closing the drawer resets back to preset mode with an empty prompt', async () => {
    renderProbe(harness, client, baseProps())
    await flush()
    act(() => {
      latest!.openDrawer()
    })
    await flush()
    act(() => {
      latest!.onWriteManually()
    })
    await flush()
    act(() => {
      latest!.setPromptText('draft text')
    })
    await flush()

    act(() => {
      latest!.closeDrawer()
    })
    await flush()

    expect(latest!.mode).toBe('preset')
    expect(latest!.promptText).toBe('')
  })
})
