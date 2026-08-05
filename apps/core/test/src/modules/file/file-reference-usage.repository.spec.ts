import { describe, expect, it } from 'vitest'

import {
  containsFileUrlReference,
  findUsageMatchesInSources,
} from '~/modules/file/file-reference-usage.repository'

describe('findUsageMatchesInSources', () => {
  it('preserves every persisted source and field for a shared file URL', () => {
    const fileUrl = 'https://cdn.example.com/shared-cover.png'

    expect(
      findUsageMatchesInSources(
        [fileUrl, 'https://cdn.example.com/unused.pdf'],
        [
          {
            fields: { meta: { cover: fileUrl } },
            sourceId: 'post-1',
            sourceType: 'post',
          },
          {
            fields: { raw: `asset: ${fileUrl}` },
            sourceId: 'skill-1',
            sourceType: 'skill',
          },
        ],
      ),
    ).toEqual([
      {
        fileUrl,
        sourceField: 'meta',
        sourceId: 'post-1',
        sourceType: 'post',
      },
      {
        fileUrl,
        sourceField: 'raw',
        sourceId: 'skill-1',
        sourceType: 'skill',
      },
    ])
  })

  it('does not treat a longer path as a reference to its URL prefix', () => {
    const fileUrl = 'https://cdn.example.com/assets/cover.png'

    expect(
      containsFileUrlReference(
        `https://cdn.example.com/assets/cover.png.backup`,
        fileUrl,
      ),
    ).toBe(false)
    expect(
      findUsageMatchesInSources(
        [fileUrl],
        [
          {
            fields: { content: `asset: ${fileUrl}.backup` },
            sourceId: 'post-prefix',
            sourceType: 'post',
          },
        ],
      ),
    ).toEqual([])
  })

  it('accepts query, fragment, markup, and terminal punctuation boundaries', () => {
    const fileUrl = 'https://cdn.example.com/assets/cover.png'
    const values = [
      `${fileUrl}?width=640`,
      `${fileUrl}#preview`,
      `![cover](${fileUrl})`,
      `<img src="${fileUrl}">`,
      `See ${fileUrl}.`,
    ]

    for (const value of values) {
      expect(containsFileUrlReference(value, fileUrl)).toBe(true)
    }
  })

  it('matches encoded local object URLs without decoding their path', () => {
    const fileUrl =
      'https://api.example.com/objects/file/%E8%B5%84%E6%96%99%20100%25%23.zip'

    expect(
      containsFileUrlReference(
        JSON.stringify({ attachment: fileUrl }),
        fileUrl,
      ),
    ).toBe(true)
  })
})
