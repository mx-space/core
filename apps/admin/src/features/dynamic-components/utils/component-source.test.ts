// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  checkComponentModule,
  fetchComponentSource,
  saveComponentSource,
} from './component-source'

const uploadFile = vi.fn()
const updateDynamicComponentEntry = vi.fn()

vi.mock('~/api/files', () => ({
  uploadFile: (...args: unknown[]) => uploadFile(...args),
}))
vi.mock('~/api/dynamic-components', () => ({
  updateDynamicComponentEntry: (...args: unknown[]) =>
    updateDynamicComponentEntry(...args),
}))

afterEach(() => {
  uploadFile.mockReset()
  updateDynamicComponentEntry.mockReset()
})

describe('checkComponentModule', () => {
  it('accepts a module whose default export has mount', async () => {
    await expect(
      checkComponentModule('blob:x', async () => ({
        default: { mount: () => ({ unmount() {} }) },
      })),
    ).resolves.toBeNull()
  })

  it('rejects a module without the mount protocol', async () => {
    await expect(
      checkComponentModule('blob:x', async () => ({ default: {} })),
    ).resolves.toMatch(/mount/)
  })

  it('reports a mount that throws with the given props', async () => {
    const mount = vi.fn(
      (_container: HTMLElement, input: { props: Record<string, unknown> }) => {
        if (input.props.value === undefined)
          throw new TypeError('value is required')
        return { unmount() {} }
      },
    )

    await expect(
      checkComponentModule('blob:x', async () => ({ default: { mount } }), {}),
    ).resolves.toBe('TypeError: value is required')
    await expect(
      checkComponentModule('blob:x', async () => ({ default: { mount } }), {
        value: 1,
      }),
    ).resolves.toBeNull()
  })

  it('unmounts the trial mount', async () => {
    const unmount = vi.fn()
    await checkComponentModule('blob:x', async () => ({
      default: { mount: () => ({ unmount }) },
    }))
    expect(unmount).toHaveBeenCalledTimes(1)
  })

  it('reports an import failure such as a syntax error', async () => {
    await expect(
      checkComponentModule('blob:x', async () => {
        throw new SyntaxError("Unexpected token '}'")
      }),
    ).resolves.toBe("SyntaxError: Unexpected token '}'")
  })
})

describe('saveComponentSource', () => {
  it('uploads the source as a new immutable file and points the entry at it', async () => {
    uploadFile.mockResolvedValue({
      url: 'https://api.example/objects/file/versions/v2.js',
    })
    const catalog = { version: 1, components: [] }
    updateDynamicComponentEntry.mockResolvedValue(catalog)

    const result = await saveComponentSource(
      {
        id: '42',
        name: 'Progress Ring',
        url: 'https://api.example/objects/file/versions/v1.js',
      },
      'export default {}',
    )

    const [file, type, immutable] = uploadFile.mock.calls[0]
    expect(file).toBeInstanceOf(File)
    expect(file.name).toMatch(/^progress-ring-.+\.js$/)
    expect(file.type).toBe('text/javascript')
    await expect(file.text()).resolves.toBe('export default {}')
    expect([type, immutable]).toEqual(['file', true])
    expect(updateDynamicComponentEntry).toHaveBeenCalledWith('42', {
      parentUrl: 'https://api.example/objects/file/versions/v1.js',
      url: 'https://api.example/objects/file/versions/v2.js',
    })
    expect(result).toBe(catalog)
  })
})

describe('fetchComponentSource', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns the module text without sending credentials', async () => {
    const fetchMock = vi.fn(async () => new Response('export default {}'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      fetchComponentSource('https://cdn.example/widget.js'),
    ).resolves.toBe('export default {}')
    expect(fetchMock).toHaveBeenCalledWith('https://cdn.example/widget.js', {
      cache: 'no-store',
      credentials: 'omit',
    })
  })

  it('fails when the module cannot be read', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 404 })),
    )

    await expect(
      fetchComponentSource('https://cdn.example/missing.js'),
    ).rejects.toThrow('404')
  })
})
