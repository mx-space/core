import type { StockSlotProps } from './stock-augment'
import { StockBlock } from './StockBlock'

export function StockBlockReadonly(props: StockSlotProps) {
  return <StockBlock {...props} />
}
