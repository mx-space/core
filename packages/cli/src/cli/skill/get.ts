import { Args, Command } from '@effect/cli'
import { Effect } from 'effect'

import { Renderer } from '../../services/Renderer'
import { Skill } from '../../services/Skill'
import { skillChapterView } from './views'

const slugArg = Args.text({ name: 'slug' })

export const get = Command.make('get', { slug: slugArg }, ({ slug }) =>
  Effect.gen(function* () {
    const skill = yield* Skill
    const renderer = yield* Renderer
    const chapter = yield* skill.get(slug)
    yield* renderer.emit(skillChapterView, chapter)
  }),
)
