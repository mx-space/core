import { Get, Param, Post, Query, Res } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'
import type { FastifyReply } from 'fastify'

import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { BizException } from '~/common/exceptions/biz.exception'
import { CollectionRefTypes } from '~/constants/db.constant'
import { ErrorCodeEnum } from '~/constants/error-code.constant'
import { DatabaseService } from '~/processors/database/database.service'
import { ImageService } from '~/processors/helper/helper.image.service'
import { UrlBuilderService } from '~/processors/helper/helper.url-builder.service'
import { EntityIdDto } from '~/shared/dto/id.dto'
import { isLexical } from '~/utils/content.util'
import { AsyncQueue } from '~/utils/queue.util'

import { NoteService } from '../note/note.service'
import { PageService } from '../page/page.service'
import { PostService } from '../post/post.service'

@ApiController('helper')
export class HelperController {
  constructor(
    private readonly urlBulderService: UrlBuilderService,
    private readonly databaseService: DatabaseService,

    private readonly moduleRef: ModuleRef,
  ) {}

  @Get('/url-builder/:id')
  async builderById(
    @Param() params: EntityIdDto,
    @Query('redirect') redirect: boolean,

    @Res() res: FastifyReply,
  ) {
    const doc = await this.databaseService.findGlobalById(params.id)
    if (!doc || doc.type === CollectionRefTypes.Recently) {
      if (redirect) {
        throw new BizException(
          ErrorCodeEnum.DocumentNotFound,
          'not found or this type can not redirect to',
        )
      }

      res.send(null)
      return
    }

    const url = await this.urlBulderService.buildWithBaseUrl(doc.document)

    if (redirect) {
      res.status(301).redirect(url)
    } else {
      res.send({ data: url })
    }
  }

  @Post('/refresh-images')
  @Auth()
  async refreshImages() {
    const postService = this.moduleRef.get(PostService, { strict: false })
    const noteService = this.moduleRef.get(NoteService, { strict: false })
    const pageService = this.moduleRef.get(PageService, { strict: false })
    const imageService = this.moduleRef.get(ImageService, { strict: false })
    const post = await postService.findRecent(50)
    const notes = await noteService.findRecent(50)
    const pages = await pageService.findRecent(50)

    const q = new AsyncQueue(10)
    q.addMultiple(
      [...post, ...notes, ...pages]
        .filter((doc) => !isLexical(doc))
        .map(
          (doc) => () =>
            imageService.saveImageDimensionsFromMarkdownText(
              doc.text,
              doc.images,
              (images) => {
                doc.images = images
                if ('categoryId' in doc) {
                  return postService.updateById(doc.id, { images } as any)
                }
                if ('nid' in doc) {
                  return noteService.updateById(doc.id, { images } as any)
                }
                return pageService.updateById(doc.id, { images } as any)
              },
            ),
        ),
    )
  }
}
