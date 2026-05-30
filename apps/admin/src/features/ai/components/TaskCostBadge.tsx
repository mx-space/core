import { Badge } from '~/ui/primitives/badge'

export function TaskCostBadge(props: {
  className?: string
  cost: number | undefined
}) {
  if (props.cost == null || props.cost === 0) return null
  return (
    <Badge
      className={props.className}
      title={`${props.cost.toFixed(6)} USD`}
      tone="neutral"
      variant="outline"
    >
      <span className="tabular-nums">${props.cost.toFixed(4)} USD</span>
    </Badge>
  )
}
