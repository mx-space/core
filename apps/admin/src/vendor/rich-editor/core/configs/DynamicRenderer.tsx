import type { DynamicSlotProps } from '@haklex/rich-ext-dynamic/static'
import { DynamicSSRRenderer } from '@haklex/rich-ext-dynamic/static'

import { isAllowedDynamicUrl } from '../../utils/dynamic-catalog'

export function MxDynamicRenderer(props: DynamicSlotProps) {
  return <DynamicSSRRenderer {...props} validateUrl={isAllowedDynamicUrl} />
}
