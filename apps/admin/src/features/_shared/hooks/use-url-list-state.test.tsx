import { act, createElement, useEffect } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useNavigate, useSearchParams } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'

import {
  collectOwnedSearchParamKeys,
  mergeListSearchParams,
  searchParamsEqual,
  useUrlListState,
} from './use-url-list-state'

interface PageState {
  page: number
}

const pageOnlyOptions = {
  read: (searchParams: URLSearchParams): PageState => ({
    page: readPage(searchParams.get('page')),
  }),
  write: (state: PageState) => {
    const nextParams = new URLSearchParams()
    if (state.page > 1) nextParams.set('page', String(state.page))
    return nextParams
  },
}

function readPage(value: null | string) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 1 ? parsed : 1
}

describe('mergeListSearchParams', () => {
  it('keeps foreign keys such as edit when rewriting owned fields', () => {
    const next = mergeListSearchParams(
      new URLSearchParams('page=2&edit=1'),
      new URLSearchParams('page=2'),
      ['page'],
    )
    expect(next.get('edit')).toBe('1')
    expect(next.get('page')).toBe('2')
  })

  it('drops owned keys omitted from write while preserving foreign keys', () => {
    const next = mergeListSearchParams(
      new URLSearchParams('page=2&edit=1'),
      new URLSearchParams(),
      ['page'],
    )
    expect(next.get('edit')).toBe('1')
    expect(next.has('page')).toBe(false)
  })
})

describe('collectOwnedSearchParamKeys', () => {
  it('includes keys read from the URL and keys emitted by write', () => {
    const owned = collectOwnedSearchParamKeys(
      (searchParams) => ({
        page: searchParams.get('page'),
        tab: searchParams.get('tab'),
      }),
      new URLSearchParams('page=2&tab=unread'),
      new URLSearchParams('tab=unread'),
    )
    expect([...owned].sort()).toEqual(['page', 'tab'])
  })
})

describe('searchParamsEqual', () => {
  it('treats the same entries as equal regardless of key order', () => {
    expect(
      searchParamsEqual(
        new URLSearchParams('page=2&edit=1'),
        new URLSearchParams('edit=1&page=2'),
      ),
    ).toBe(true)
  })
})

interface ProbeApi {
  navigate: (to: string) => void
  page: number
  search: string
  setPage: (page: number) => void
}

interface Harness {
  api: ProbeApi | null
  unmount: () => void
}

function Probe({ onReady }: { onReady: (api: ProbeApi) => void }) {
  const [state, setState] = useUrlListState(pageOnlyOptions)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    onReady({
      navigate,
      page: state.page,
      search: searchParams.toString(),
      setPage: (page: number) => setState({ page }),
    })
  })

  return null
}

function mount(initialEntry: string): Harness {
  const container = document.createElement('div')
  document.body.append(container)
  const root: Root = createRoot(container)
  const harness: Harness = {
    api: null,
    unmount: () => {
      act(() => {
        root.unmount()
      })
      container.remove()
    },
  }

  act(() => {
    root.render(
      createElement(
        MemoryRouter,
        { initialEntries: [initialEntry] },
        createElement(Probe, {
          onReady: (api) => {
            harness.api = api
          },
        }),
      ),
    )
  })

  return harness
}

async function flush() {
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  })
}

describe('useUrlListState', () => {
  let harness: Harness | null = null

  afterEach(() => {
    harness?.unmount()
    harness = null
  })

  it('does not strip unrelated edit=1 when canonicalizing page', async () => {
    harness = mount('/projects/1?page=2')
    await flush()
    expect(harness.api?.search).toBe('page=2')

    act(() => {
      harness?.api?.navigate('/projects/1?page=2&edit=1')
    })
    await flush()

    expect(new URLSearchParams(harness.api?.search).get('edit')).toBe('1')
    expect(new URLSearchParams(harness.api?.search).get('page')).toBe('2')
    expect(harness.api?.page).toBe(2)
  })

  it('updates page without dropping edit, and omits page=1', async () => {
    harness = mount('/projects/1?page=2&edit=1')
    await flush()

    act(() => {
      harness?.api?.setPage(3)
    })
    await flush()

    expect(new URLSearchParams(harness.api?.search).get('edit')).toBe('1')
    expect(new URLSearchParams(harness.api?.search).get('page')).toBe('3')

    act(() => {
      harness?.api?.setPage(1)
    })
    await flush()

    expect(new URLSearchParams(harness.api?.search).get('edit')).toBe('1')
    expect(new URLSearchParams(harness.api?.search).has('page')).toBe(false)
  })
})
