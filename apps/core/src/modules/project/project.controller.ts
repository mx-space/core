import { BasePgCrudFactory } from '~/transformers/crud-factor.pg.transformer'

import { ProjectRepository } from './project.repository'

export class ProjectController extends BasePgCrudFactory({
  repository: ProjectRepository,
}) {}
