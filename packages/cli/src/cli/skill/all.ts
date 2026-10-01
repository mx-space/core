import { Effect } from 'effect'
import { Command } from 'effect/cli'

import { Renderer } from '../../services/Renderer'
import { Skill } from '../../services/Skill'
import { skillAllView } from './views'

export const all = Command.make('all', {}, () =>
  Effect.gen(function* () {
    const skill = yield* Skill
    const renderer = yield* Renderer
    const chapters = yield* skill.all
    yield* renderer.emit(skillAllView, chapters)
  }),
)
