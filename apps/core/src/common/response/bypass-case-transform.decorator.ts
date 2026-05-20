import { SetMetadata } from '@nestjs/common'

import { BYPASS_CASE_TRANSFORM_METADATA } from '~/constants/system.constant'

// Paths root at response `data`; dotted segments, `[]` marks an array level.
// A matched subtree is emitted verbatim — its keys skip snake_case conversion.
export const BypassCaseTransform = (paths: string[]) =>
  SetMetadata(BYPASS_CASE_TRANSFORM_METADATA, paths)
