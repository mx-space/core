import type { ToolResultMessage, UserMessage } from '@earendil-works/pi-ai'
import sharp from 'sharp'
import { describe, expect, it, vi } from 'vitest'

import {
  createImageLoader,
  hydrateImages,
  toolResultContent,
  userContent,
} from '~/modules/ai/ai-agent/ai-agent-images'

const URL_A = 'https://cdn.example.test/versions/a.png'

const toolMessage = (
  content: ToolResultMessage['content'],
): ToolResultMessage => ({
  role: 'toolResult',
  toolCallId: 'call_1',
  toolName: 'bash',
  isError: false,
  timestamp: 0,
  content,
})

describe('toolResultContent', () => {
  it('keeps images as URL references after the text', () => {
    expect(
      toolResultContent('shown', [{ url: URL_A, mimeType: 'image/png' }]),
    ).toEqual([
      { type: 'text', text: 'shown' },
      { type: 'image', data: URL_A, mimeType: 'image/png' },
    ])
  })
})

describe('userContent', () => {
  it('stays a plain string without images', () => {
    expect(userContent('hello', [])).toBe('hello')
  })

  it('appends image URL references after the text', () => {
    expect(
      userContent('see this', [{ url: URL_A, mimeType: 'image/png' }]),
    ).toEqual([
      { type: 'text', text: 'see this' },
      { type: 'image', data: URL_A, mimeType: 'image/png' },
    ])
  })
})

describe('hydrateImages', () => {
  it('loads image references in user messages', async () => {
    const stored: UserMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'see this' },
          { type: 'image', data: URL_A, mimeType: 'image/png' },
        ],
        timestamp: 0,
      },
    ]

    const hydrated = await hydrateImages(stored, async () => ({
      data: 'QUJD',
      mimeType: 'image/png',
    }))

    expect((hydrated[0] as UserMessage).content).toEqual([
      { type: 'text', text: 'see this' },
      { type: 'image', data: 'QUJD', mimeType: 'image/png' },
    ])
  })

  it('replaces URL references with loaded base64 without touching the stored transcript', async () => {
    const stored = [
      toolMessage([
        { type: 'text', text: 'shown' },
        { type: 'image', data: URL_A, mimeType: 'image/png' },
      ]),
    ]
    const loader = vi.fn(async () => ({ data: 'QUJD', mimeType: 'image/jpeg' }))

    const hydrated = await hydrateImages(stored, loader)

    expect(hydrated[0]).toMatchObject({
      content: [
        { type: 'text', text: 'shown' },
        { type: 'image', data: 'QUJD', mimeType: 'image/jpeg' },
      ],
    })
    expect((stored[0].content[1] as { data: string }).data).toBe(URL_A)
  })

  it('turns an image that cannot be loaded into a text note', async () => {
    const hydrated = await hydrateImages(
      [toolMessage([{ type: 'image', data: URL_A, mimeType: 'image/png' }])],
      async () => null,
    )

    expect((hydrated[0] as ToolResultMessage).content).toEqual([
      { type: 'text', text: `[image unavailable: ${URL_A}]` },
    ])
  })

  it('leaves inline base64 images and other messages alone', async () => {
    const user: UserMessage = {
      role: 'user',
      content: [{ type: 'image', data: 'QUJD', mimeType: 'image/png' }],
      timestamp: 0,
    }
    const loader = vi.fn()

    const hydrated = await hydrateImages([user], loader)

    expect(hydrated[0]).toEqual(user)
    expect(loader).not.toHaveBeenCalled()
  })
})

describe('createImageLoader', () => {
  const png = (width: number, height: number) =>
    sharp({
      create: { width, height, channels: 3, background: '#336699' },
    })
      .png()
      .toBuffer()

  it('refuses hosts outside the site storage without fetching', async () => {
    const fetchImpl = vi.fn()
    const load = createImageLoader({
      allowedHosts: ['cdn.example.test'],
      fetch: fetchImpl as never,
    })

    expect(await load('https://evil.example.test/a.png')).toBeNull()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('shrinks a large image to a 1568px long edge', async () => {
    const bytes = await png(3000, 1000)
    const load = createImageLoader({
      allowedHosts: ['cdn.example.test'],
      fetch: (async () =>
        new Response(new Uint8Array(bytes), {
          headers: { 'content-type': 'image/png' },
        })) as never,
    })

    const loaded = await load(URL_A)

    const meta = await sharp(Buffer.from(loaded!.data, 'base64')).metadata()
    expect(meta.width).toBe(1568)
    expect(loaded!.mimeType).toBe('image/png')
  })

  it('gives up on a response that is not an image', async () => {
    const load = createImageLoader({
      allowedHosts: ['cdn.example.test'],
      fetch: (async () =>
        new Response('<html>', {
          headers: { 'content-type': 'text/html' },
        })) as never,
    })

    expect(await load(URL_A)).toBeNull()
  })
})
