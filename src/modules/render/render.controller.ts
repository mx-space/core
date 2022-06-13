import ejs from 'ejs'
import { FastifyReply } from 'fastify'
import { resolve } from 'path'

import { Controller, Get, Res } from '@nestjs/common'

import { HTTPDecorators } from '~/common/decorator/http.decorator'
import { ApiName } from '~/common/decorator/openapi.decorator'
import { THEME_DIR } from '~/constants/path.constant'

@ApiName
@Controller('/')
export class RenderEjsController {
  @Get(isDev ? '/render/*' : '/')
  @HTTPDecorators.Bypass
  async render(@Res() reply: FastifyReply) {
    const result = await ejs.renderFile(
      this.getEjsFilePath('layout/index.ejs'),
      {
        page: {
          posts: [],
        },
        paginator: () => {},
        list_categories: () => {
          return []
        },
        list_tags: () => [],
        tagcloud: () => 2,
        list_archives: () => [],
        url_for: () => 'http',
      },
    )
    return reply.type('text/html').send(result)
  }

  getEjsFilePath(filename: string, theme = 'blank') {
    return resolve(THEME_DIR, theme, filename)
  }
}
