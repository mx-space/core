import { afterEach, describe, expect, it, vi } from 'vitest'

import { type ConfigFormSchema, getAllOptions } from './options'

afterEach(() => vi.unstubAllGlobals())

describe('settings values and form schema', () => {
  it('restores declared acronym keys after wire camelization so fields display and save the existing values', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              data: {
                comment_upload_options: {
                  single_file_size_mb: 7,
                  reader_total_active_bytes_mb: 70,
                  enable: true,
                },
                opaque: { customField: { APIKey: 'preserved' } },
              },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
      ),
    )
    const schema: ConfigFormSchema = {
      title: 'Settings',
      defaults: {},
      groups: [
        {
          key: 'storage',
          title: 'Storage',
          description: '',
          icon: 'database',
          sections: [
            {
              key: 'commentUploadOptions',
              title: 'Comment uploads',
              fields: [
                {
                  key: 'singleFileSizeMB',
                  title: 'File limit',
                  ui: { component: 'number' },
                },
                {
                  key: 'readerTotalActiveBytesMB',
                  title: 'Total limit',
                  ui: { component: 'number' },
                },
              ],
            },
          ],
        },
      ],
    }
    expect(await getAllOptions(schema)).toEqual({
      commentUploadOptions: {
        singleFileSizeMB: 7,
        readerTotalActiveBytesMB: 70,
        enable: true,
      },
      opaque: { customField: { APIKey: 'preserved' } },
    })
  })
})
