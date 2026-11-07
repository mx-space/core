import { describe, expect, it } from 'vitest'

import { isOwnStorageUrl, ownStorageHosts } from './own-storage-hosts'

describe('ownStorageHosts', () => {
  it('collects the API, site and custom storage hosts', () => {
    expect(
      ownStorageHosts({
        apiUrl: 'https://api.example.test/v3',
        webUrl: 'https://example.test',
        serverUrl: 'https://api.example.test',
        customDomain: 'https://cdn.example.test',
      }),
    ).toEqual(['api.example.test', 'example.test', 'cdn.example.test'])
  })

  it('skips missing and malformed entries', () => {
    expect(
      ownStorageHosts({
        apiUrl: 'https://api.example.test',
        customDomain: 'not a url',
      }),
    ).toEqual(['api.example.test'])
  })
})

describe('isOwnStorageUrl', () => {
  const hosts = ['cdn.example.test']

  it('accepts http(s) URLs on an own host', () => {
    expect(isOwnStorageUrl('https://cdn.example.test/a.png', hosts)).toBe(true)
  })

  it('rejects other hosts and non-URLs', () => {
    expect(isOwnStorageUrl('https://evil.test/a.png', hosts)).toBe(false)
    expect(isOwnStorageUrl('/embeds/a.png', hosts)).toBe(false)
    expect(isOwnStorageUrl('javascript:alert(1)', hosts)).toBe(false)
  })
})
