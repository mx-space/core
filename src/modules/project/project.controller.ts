import { BaseCrudFactory } from '~/utils/crud.util'
import { ProjectModel } from './project.model'

export class ProjectContoller extends BaseCrudFactory({
  model: ProjectModel,
}) {}
