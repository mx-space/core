import {
  BadRequestException,
  Get,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'
import { ApiController } from '~/common/decorators/api-controller.decorator'
import { Auth } from '~/common/decorators/auth.decorator'
import { CollectionRefTypes } from '~/constants/db.constant'
import { DatabaseService } from '~/processors/database/database.service'
import { ImageService } from '~/processors/helper/helper.image.service'
import { UrlBuilderService } from '~/processors/helper/helper.url-builder.service'
import { MongoIdDto } from '~/shared/dto/id.dto'
import { AsyncQueue } from '~/utils/queue.util'
import { FastifyReply } from 'fastify'
import { NoteService } from '../note/note.service'
import { PageService } from '../page/page.service'
import { PostService } from '../post/post.service'
import { HelperService } from './helper.service'

@ApiController('helper')
export class HelperController {
  constructor(
    private readonly helperService: HelperService,

    private readonly urlBulderService: UrlBuilderService,
    private readonly databaseService: DatabaseService,

    private readonly moduleRef: ModuleRef,
  ) {}

  @Get('/url-builder/:id')
  async builderById(
    @Param() params: MongoIdDto,
    @Query('redirect') redirect: boolean,

    @Res() res: FastifyReply,
  ) {
    const doc = await this.databaseService.findGlobalById(params.id)
    if (!doc || doc.type === CollectionRefTypes.Recently) {
      if (redirect) {
        throw new BadRequestException(
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
    const post = await postService.model.find()
    const notes = await noteService.model.find()
    const pages = await pageService.model.find()

    const q = new AsyncQueue(10)
    q.addMultiple(
      [...post, ...notes, ...pages].map(
        (doc) => () =>
          imageService.saveImageDimensionsFromMarkdownText(
            doc.text,
            doc.images,
            (images) => {
              doc.images = images
              return doc.save()
            },
          ),
      ),
    )
  }
}
