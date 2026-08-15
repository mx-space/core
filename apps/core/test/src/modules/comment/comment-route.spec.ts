import { RequestMethod } from '@nestjs/common'
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants'
import { describe, expect, it } from 'vitest'

import { CommentController } from '~/modules/comment/comment.controller'

describe('CommentController routes', () => {
  it('uses explicit guest and reader write routes', () => {
    const prototype = CommentController.prototype

    expect(Reflect.getMetadata(PATH_METADATA, prototype.guestComment)).toBe(
      '/guest/:id',
    )
    expect(Reflect.getMetadata(PATH_METADATA, prototype.readerComment)).toBe(
      '/reader/:id',
    )
    expect(Reflect.getMetadata(PATH_METADATA, prototype.guestReplyByCid)).toBe(
      '/guest/reply/:id',
    )
    expect(Reflect.getMetadata(PATH_METADATA, prototype.readerReplyByCid)).toBe(
      '/reader/reply/:id',
    )

    expect(Reflect.getMetadata(METHOD_METADATA, prototype.guestComment)).toBe(
      RequestMethod.POST,
    )
    expect(Reflect.getMetadata(METHOD_METADATA, prototype.readerComment)).toBe(
      RequestMethod.POST,
    )

    expect((prototype as Record<string, unknown>).ownerReplyByCid).toBe(
      undefined,
    )
  })

  it('exposes reader activity and public report routes ahead of /:id', () => {
    const prototype = CommentController.prototype
    expect(Reflect.getMetadata(PATH_METADATA, prototype.getMyComments)).toBe(
      '/reader/me',
    )
    expect(Reflect.getMetadata(METHOD_METADATA, prototype.getMyComments)).toBe(
      RequestMethod.GET,
    )
    expect(Reflect.getMetadata(PATH_METADATA, prototype.reportComment)).toBe(
      '/:id/report',
    )
    expect(Reflect.getMetadata(METHOD_METADATA, prototype.reportComment)).toBe(
      RequestMethod.POST,
    )

    const names = Object.getOwnPropertyNames(prototype)
    expect(names.indexOf('getMyComments')).toBeLessThan(
      names.indexOf('getComments'),
    )
  })
})
