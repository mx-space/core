import { describe, expect, it } from 'vitest'

import { parseSponsorsCsv } from '~/modules/membership/sponsors-csv'

describe('parseSponsorsCsv', () => {
  it('parses rows with quoted commas, blanks and CRLF', () => {
    const csv =
      '﻿github_id,email,handle,months,note\r\n' +
      '12345,,,12,"GitHub sponsor, $5 tier"\r\n' +
      ',Bar@X.com,,,\r\n' +
      ',,baz,abc,\r\n' +
      '\r\n'
    expect(parseSponsorsCsv(csv)).toEqual([
      {
        line: 2,
        githubId: '12345',
        email: null,
        handle: null,
        months: 12,
        note: 'GitHub sponsor, $5 tier',
      },
      {
        line: 3,
        githubId: null,
        email: 'bar@x.com',
        handle: null,
        months: null,
        note: null,
      },
      {
        line: 4,
        githubId: null,
        email: null,
        handle: 'baz',
        months: null,
        note: null,
      },
    ])
  })

  it('accepts a header subset in any order', () => {
    expect(parseSponsorsCsv('months,email\n3,a@b.c')).toEqual([
      {
        line: 2,
        githubId: null,
        email: 'a@b.c',
        handle: null,
        months: 3,
        note: null,
      },
    ])
  })

  it('rejects headers without an identity column', () => {
    expect(() => parseSponsorsCsv('months,note\n1,x')).toThrow(/github_id/)
  })

  it('returns nothing for empty input', () => {
    expect(parseSponsorsCsv('')).toEqual([])
  })
})
