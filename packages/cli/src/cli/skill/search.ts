import { Effect } from 'effect'
import { Argument, Command } from 'effect/cli'

import { Renderer } from '../../services/Renderer'
import { Skill } from '../../services/Skill'
import { skillSearchView } from './views'

const keywordArg = Argument.String('keyword')

export const search = Command.make(
  'search',
  { keyword: keywordArg },
  ({ keyword }) =>
    Effect.gen(function* () {
      const skill = yield* Skill
      const renderer = yield* Renderer
      const hits = yield* skill.search(keyword)
      yield* renderer.emit(skillSearchView, hits)
    }),
)
