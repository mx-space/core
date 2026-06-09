import type { IRequestAdapter } from '~/interfaces/adapter'
import type {
  ProjectCreateInput,
  ProjectModel,
  ProjectPatchInput,
} from '~/models/project'
import { autoBind } from '~/utils/auto-bind'

import type { HTTPClient } from '../core'
import { BaseCrudController } from './base'

declare module '@mx-space/api-client' {
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

  create(input: ProjectCreateInput) {
    return this.proxy.post<ProjectModel>({ data: input })
  }

  update(id: string, patch: ProjectPatchInput) {
    return this.proxy(id).patch<ProjectModel>({ data: patch })
  }

  delete(id: string) {
    return this.proxy(id).delete<ProjectModel>()
  }
}
