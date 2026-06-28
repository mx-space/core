import type { StockSlotProps } from './stock-augment'
import { StockKLineView } from './StockKLineView'
import { StockSnapshotView } from './StockSnapshotView'

export function StockBlock(props: StockSlotProps) {
  if (props.variant === 'kline') {
    if (!props.range) return null
    return (
      <StockKLineView
        ema={props.ema}
        range={props.range}
        symbol={props.symbol}
      />
    )
  }
  return <StockSnapshotView symbol={props.symbol} />
}
