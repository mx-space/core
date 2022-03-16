import { ProjectModel } from './project.model'
import { BaseCrudFactory } from '~/utils/crud.util'

export class ProjectController extends BaseCrudFactory({
  model: ProjectModel,
}) {}
