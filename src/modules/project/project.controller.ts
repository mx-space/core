import { ProjectModel } from './project.model'
import { BaseCrudFactory } from '~/transformers/crud-factor.transformer'

export class ProjectController extends BaseCrudFactory({
  model: ProjectModel,
}) {}
