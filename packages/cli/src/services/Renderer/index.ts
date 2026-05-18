import { Context, Effect, Layer } from 'effect'

import { currentOutputOptions } from './options'
import { makeService, type RendererService } from './service'

export { renderReadableGeneric } from './lists'
export {
  currentOutputOptions,
  defaultOutputOptions,
  type OutputMode,
  type OutputOptions,
} from './options'
export type { RendererService } from './service'
export type { View, ViewCtx } from './view'

export class Renderer extends Context.Tag('Renderer')<
  Renderer,
  RendererService
>() {
  static Default: Layer.Layer<Renderer> = Layer.succeed(Renderer, makeService())

  /** Apply the given `OutputOptions` for the duration of `effect`. */
  static withOptions: <A, E, R>(
    options: import('./options').OutputOptions,
  ) => (effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R> =
    (options) => (effect) =>
      Effect.locally(effect, currentOutputOptions, options)
}
