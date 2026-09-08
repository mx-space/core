// @vitest-environment node

import { beforeEach, expect, it, vi } from 'vitest'

import { registerDynamicComponent } from './dynamic-catalog'

const getSnippetByPath = vi.fn()
const createSnippet = vi.fn()
const updateSnippet = vi.fn()
vi.mock('~/constants/env', () => ({ API_URL: 'https://api.example' }))
vi.mock('~/api/snippets', () => ({
  getSnippetByPath: (...args: unknown[]) => getSnippetByPath(...args),
  createSnippet: (...args: unknown[]) => createSnippet(...args),
  updateSnippet: (...args: unknown[]) => updateSnippet(...args),
}))

const entry = {
  name: 'Counter',
  description: 'Counter',
  url: 'https://cdn.example/counter.js',
  initialHeight: 320,
  propsSchema: {},
}

beforeEach(() => vi.resetAllMocks())

it('reads the exact catalog path and preserves existing entries when adding another component', async () => {
  const original = {
    ...entry,
    name: 'Existing',
    url: 'https://cdn.example/existing.js',
  }
  getSnippetByPath.mockResolvedValue({
    id: 'catalog',
    path: 'dynamic-widgets-catalog',
    type: 'json',
    raw: JSON.stringify({ version: 1, components: [original] }),
  })
  await registerDynamicComponent(entry)
  expect(getSnippetByPath).toHaveBeenCalledWith('dynamic-widgets-catalog')
  expect(createSnippet).not.toHaveBeenCalled()
  const [id, body] = updateSnippet.mock.calls[0]
  expect(id).toBe('catalog')
  expect(body.path).toBe('dynamic-widgets-catalog')
  expect(JSON.parse(body.raw).components).toEqual([original, entry])

  getSnippetByPath.mockResolvedValue({ id, ...body })
  await registerDynamicComponent(entry)
  expect(updateSnippet).toHaveBeenCalledTimes(1)
})

it('creates a public catalog only when absent and never overwrites malformed existing data', async () => {
  getSnippetByPath.mockResolvedValueOnce(null)
  await registerDynamicComponent(entry)
  expect(createSnippet).toHaveBeenCalledWith(
    expect.objectContaining({
      private: false,
      path: 'dynamic-widgets-catalog',
    }),
  )
  getSnippetByPath.mockResolvedValueOnce({
    raw: '{"components":"invalid","version":1}',
  })
  await expect(registerDynamicComponent(entry)).rejects.toThrow(
    'Invalid dynamic component catalog',
  )
  expect(updateSnippet).not.toHaveBeenCalled()
  expect(createSnippet).toHaveBeenCalledTimes(1)
})
