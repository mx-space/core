import { SetMetadata } from '@nestjs/common'

import { BYPASS_CASE_TRANSFORM_METADATA } from '~/constants/system.constant'

/**
 * Opt a field subtree out of snake_case key conversion.
 *
 * Paths root at the response `data`. Use dotted segments to descend objects,
 * and `[]` to descend an array (e.g. `'items[].rawPayload'`).
 *
 * When a path matches, the entire matched subtree is emitted **verbatim** —
 * every nested key inside is preserved as-is, regardless of depth. Only the
 * matched node's own key on its parent is still snake-cased (because that
 * conversion is done by the parent).
 *
 * Use for free-form JSON columns and snippet payloads whose keys are
 * meaningful as-is to the consumer.
 */
export const BypassCaseTransform = (paths: string[]) =>
  SetMetadata(BYPASS_CASE_TRANSFORM_METADATA, paths)
