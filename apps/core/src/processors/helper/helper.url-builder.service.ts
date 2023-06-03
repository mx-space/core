import { URL } from 'url'
import { isDefined } from 'class-validator'

import { Injectable } from '@nestjs/common'

import { CategoryModel } from '~/modules/category/category.model'
import { ConfigsService } from '~/modules/configs/configs.service'
import { NoteModel } from '~/modules/note/note.model'
import { PageModel } from '~/modules/page/page.model'
import { PostModel } from '~/modules/post/post.model'

@Injectable()
export class UrlBuilderService {
  constructor(private readonly configsService: ConfigsService) {}
  isPostModel(model: any): model is PostModel {
    return (
      isDefined(model.title) && isDefined(model.slug) && !isDefined(model.order)
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
    if (this.isPostModel(model)) {
      return `/posts/${
        (model.category as CategoryModel).slug
      }/${encodeURIComponent(model.slug)}`
    } else if (this.isPageModel(model)) {
      return `/${model.slug}`
    } else if (this.isNoteModel(model)) {
      return `/notes/${model.nid}`
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
