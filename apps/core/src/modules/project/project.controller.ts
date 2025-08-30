import { BaseCrudFactory } from '~/transformers/crud-factor.transformer'
import { ProjectModel } from './project.model'

export class ProjectController extends BaseCrudFactory({
  model: ProjectModel,
}) {}
