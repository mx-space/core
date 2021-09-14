import { BaseCrudFactory } from '~/utils/crud.util'
import { ProjectModel } from './project.model'

export class ProjectController extends BaseCrudFactory({
  model: ProjectModel,
}) {}
