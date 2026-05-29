import { Module } from '@nestjs/common'

import { AiService } from '../ai.service'
import { AiTaskModule } from '../ai-task/ai-task.module'
import { AiPersonaController } from './ai-persona.controller'
import { PersonaProfileRepository } from './ai-persona.repository'
import { AiPersonaService } from './ai-persona.service'
import { ExemplarSelector } from './exemplar-selector'
import { PersonaDistillProcessor } from './tasks/persona-distill.processor'

@Module({
  imports: [AiTaskModule],
  controllers: [AiPersonaController],
  providers: [
    AiService,
    AiPersonaService,
    PersonaProfileRepository,
    ExemplarSelector,
    PersonaDistillProcessor,
  ],
  exports: [AiPersonaService, PersonaProfileRepository, ExemplarSelector],
})
export class AiPersonaModule {}
