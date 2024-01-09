import type { Type } from '@nestjs/common'
import type { AggregateService } from '../aggregate/aggregate.service'
import type { CategoryService } from '../category/category.service'
import type { ConfigsService } from '../configs/configs.service'
import type { FileService } from '../file/file.service'
import type { LinkService } from '../link/link.service'
import type { NoteService } from '../note/note.service'
import type { PageService } from '../page/page.service'
import type { PostService } from '../post/post.service'
import type { SayService } from '../say/say.service'

import { Injectable } from '@nestjs/common'
import { ContextIdFactory, ModuleRef } from '@nestjs/core'

import { RequestContext } from '~/common/contexts/request.context'

type AccessibleBizService = Type<
  | AggregateService
  | NoteService
  | PostService
  | CategoryService
  | LinkService
  | ConfigsService
  | FileService
  | PageService
  | SayService
>

@Injectable()
export class PluginService {
  constructor(private readonly moduleRef: ModuleRef) {}

  async accessBizService(service: AccessibleBizService) {
    const id = ContextIdFactory.getByRequest(RequestContext.currentRequest()!)

    return await this.moduleRef.resolve(service, id, {
      strict: false,
    })
  }
}
