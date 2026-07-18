import type {
  ArticleRefMap,
  InsightsMeta,
  PaywallMeta,
  PostResponseMeta,
  RelatedRef,
  SummaryMeta,
} from '~/common/response/meta.types'
import { PostResponseMetaSchema } from '~/common/response/meta.types'
import { MetaObjectBuilder } from '~/common/response/meta-builder'
import type { SkillBundleView } from '~/modules/snippet/snippet.types'

export class PostMetaBuilder extends MetaObjectBuilder<
  typeof PostResponseMetaSchema
> {
  constructor() {
    super(PostResponseMetaSchema)
  }

  insights(value: InsightsMeta): this {
    ;(this.meta as PostResponseMeta).insights = value
    return this
  }

  related(value: RelatedRef[]): this {
    ;(this.meta as PostResponseMeta).related = value
    return this
  }

  articles(value: ArticleRefMap): this {
    ;(this.meta as PostResponseMeta).articles = value
    return this
  }

  summary(value: SummaryMeta): this {
    ;(this.meta as PostResponseMeta).summary = value
    return this
  }

  skills(value: SkillBundleView[]): this {
    ;(this.meta as PostResponseMeta).skills = value
    return this
  }

  paywall(value: PaywallMeta): this {
    ;(this.meta as PostResponseMeta).paywall = value
    return this
  }
}
