import { Command } from '@effect/cli'
import { Effect } from 'effect'

import { Renderer } from '../../services/Renderer'
import { Skill } from '../../services/Skill'
import { skillListView } from './views'

export const list = Command.make('list', {}, () =>
  Effect.gen(function* () {
    const skill = yield* Skill
    const renderer = yield* Renderer
    const chapters = yield* skill.list
    yield* renderer.emit(skillListView, chapters)
  }),
)
