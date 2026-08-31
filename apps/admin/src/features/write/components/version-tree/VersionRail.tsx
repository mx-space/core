import type { GraphRow } from './layout'
import { MAX_LANE } from './layout'

const LANE_WIDTH = 16
const LANE_INSET = 9
const MERGE_RADIUS = 8

export const laneX = (lane: number) =>
  LANE_INSET + Math.min(lane, MAX_LANE) * LANE_WIDTH

export const railWidth = (lanes: number) => laneX(lanes - 1) + LANE_INSET

export type RailTone =
  'conflict' | 'current' | 'draft' | 'online' | 'published' | 'revision'

const DOT_CLASS: Record<RailTone, string> = {
  conflict: 'size-2.5 rounded-full bg-amber-500 ring-[3px] ring-amber-500/20',
  current: 'size-2.5 rounded-full bg-accent ring-[3px] ring-accent/25',
  draft: 'size-2.5 rounded-full border-2 border-accent bg-background',
  online: 'size-3 rounded-full bg-emerald-500 ring-[3px] ring-emerald-500/25',
  published: 'size-2.5 rounded-full bg-fg-subtle',
  revision: 'size-2 rounded-full border-2 border-border-strong bg-background',
}

const mergePath = (from: number, to: number, dotY: number) => {
  const radius = Math.min(MERGE_RADIUS, from - to, dotY)
  return `M ${from} 0 V ${dotY - radius} Q ${from} ${dotY} ${from - radius} ${dotY} H ${to}`
}

export function VersionRail(props: {
  dotY: number
  row: GraphRow
  tone: RailTone
}) {
  const { dotY, row } = props
  const x = laneX(row.lane) + 0.5

  return (
    <div aria-hidden="true" className="relative shrink-0">
      <svg
        className="absolute inset-0 size-full text-border-strong"
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
      >
        {row.lanesThrough.map((lane) => (
          <line
            key={lane}
            x1={laneX(lane) + 0.5}
            x2={laneX(lane) + 0.5}
            y1={0}
            y2="100%"
          />
        ))}

        {row.incoming ? <line x1={x} x2={x} y1={0} y2={dotY} /> : null}

        {row.continues ? <line x1={x} x2={x} y1={dotY} y2="100%" /> : null}

        {row.lanesMerging.map((lane) => (
          <path d={mergePath(laneX(lane) + 0.5, x, dotY)} key={lane} />
        ))}
      </svg>

      <span
        className={`absolute ${DOT_CLASS[props.tone]}`}
        style={{
          left: x,
          top: dotY,
          transform: 'translate(-50%, -50%)',
        }}
      />
    </div>
  )
}
