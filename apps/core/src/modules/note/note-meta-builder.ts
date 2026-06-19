import type {
  InsightsMeta,
  NoteResponseMeta,
  SummaryMeta,
} from '~/common/response/meta.types'
import { NoteResponseMetaSchema } from '~/common/response/meta.types'
import { MetaObjectBuilder } from '~/common/response/meta-builder'

export class NoteMetaBuilder extends MetaObjectBuilder<
  typeof NoteResponseMetaSchema
> {
  constructor() {
    super(NoteResponseMetaSchema)
  }

  insights(value: InsightsMeta): this {
    ;(this.meta as NoteResponseMeta).insights = value
    return this
  }

  summary(value: SummaryMeta): this {
    ;(this.meta as NoteResponseMeta).summary = value
    return this
  }
}
