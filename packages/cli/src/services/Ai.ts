import { Context, Effect, Layer } from 'effect'

// v2 placeholder — interface intentionally empty; Wave 2 / v2 commands will
// extend this with translate / summarize / extract-tags methods.
export interface AiService {}

export class Ai extends Context.Tag('Ai')<Ai, AiService>() {
  static Default: Layer.Layer<Ai> = Layer.effect(
    Ai,
    Effect.die('Ai service is a v2 placeholder'),
  )
}
