import type { IRequestAdapter } from '~/interfaces/adapter'
import type { ProjectModel } from '~/models/project'
import { autoBind } from '~/utils/auto-bind'
import type { HTTPClient } from '../core'
import { BaseCrudController } from './base'

declare module '../core/client' {
  interface HTTPClient<
    T extends IRequestAdapter = IRequestAdapter,
    ResponseWrapper = unknown,
  > {
    project: ProjectController<ResponseWrapper>
  }
}

export class ProjectController<ResponseWrapper> extends BaseCrudController<
  ProjectModel,
  ResponseWrapper
> {
  constructor(protected readonly client: HTTPClient) {
    super(client)
    autoBind(this)
  }

  base = 'projects'
  name = 'project'
}
