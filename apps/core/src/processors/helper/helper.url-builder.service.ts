import { URL } from 'node:url'

import { Injectable } from '@nestjs/common'

import type { CategoryModel } from '~/modules/category/category.types'
import { ConfigsService } from '~/modules/configs/configs.service'
import type { NoteModel } from '~/modules/note/note.types'
import type { PageModel } from '~/modules/page/page.types'
import type { PostModel } from '~/modules/post/post.types'
import { isDefined } from '~/utils/validator.util'

@Injectable()
export class UrlBuilderService {
  constructor(private readonly configsService: ConfigsService) {}
  isPostModel(model: any): model is PostModel {
    return (
      isDefined(model.title) &&
      isDefined(model.slug) &&
      !isDefined(model.order) &&
      !isDefined(model.nid)
    )
  }

  isPageModel(model: any): model is PageModel {
    return (
      isDefined(model.title) && isDefined(model.slug) && isDefined(model.order)
    )
  }

  isNoteModel(model: any): model is NoteModel {
    return isDefined(model.title) && isDefined(model.nid)
  }

  build(model: PostModel | NoteModel | PageModel) {
    if (this.isNoteModel(model)) {
      return `/notes/${model.nid}`
    } else if (this.isPostModel(model)) {
      return `/posts/${
        (model.category as CategoryModel).slug
      }/${encodeURIComponent(model.slug)}`
    } else if (this.isPageModel(model)) {
      return `/${model.slug}`
    }

    return '/'
  }

  async buildWithBaseUrl(model: PostModel | NoteModel | PageModel) {
    const {
      url: { webUrl: baseURL },
    } = await this.configsService.waitForConfigReady()

    return new URL(this.build(model), baseURL).href
  }
}
