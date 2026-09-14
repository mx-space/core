import { Switch as BaseSwitch } from '@base-ui/react/switch'
import { animate, motionValue } from 'motion'
import type {
  CSSProperties,
  KeyboardEvent,
  PointerEvent,
  ReactNode,
} from 'react'
import { useEffect, useRef, useState } from 'react'

import { cn } from '~/utils/cn'

const THUMB_METRICS = {
  checkedX: 14,
  pressedCheckedX: 10,
  pressedWidth: 22,
  width: 18,
} as const

const THUMB_SPRING = { damping: 24, stiffness: 360, type: 'spring' as const }

const SWITCH_ROOT_CLASS =
  'group relative inline-flex h-[22px] w-9 min-w-9 shrink-0 cursor-pointer select-none items-center justify-start overflow-hidden rounded-full border-0 bg-border p-0.5 outline-hidden shadow-[inset_0_1.5px_2px_rgb(0_0_0/8%)] transition-[background-color,box-shadow] duration-200 ease-out [--switch-dir:1] rtl:[--switch-dir:-1] hover:not-data-disabled:bg-border-strong data-[checked]:bg-accent data-[checked]:shadow-[inset_0_1.5px_3px_rgb(0_0_0/18%)] data-[checked]:hover:not-data-disabled:bg-accent-hover data-[disabled]:cursor-not-allowed data-[disabled]:opacity-45 data-[focus-visible]:outline-hidden data-[focus-visible]:ring-[3px] data-[focus-visible]:ring-accent/15 motion-reduce:transition-none'

const SWITCH_THUMB_CLASS =
  'block h-[18px] shrink-0 rounded-full bg-white shadow-[0_0_0_0.5px_rgb(0_0_0/4%),0_1px_1px_rgb(0_0_0/6%),0_3px_8px_rgb(0_30_80/16%)] transition-[box-shadow] duration-200 ease-out [transform:translateX(calc(var(--switch-x,0px)*var(--switch-dir,1)))] group-hover:not-group-data-disabled:shadow-[0_0_0_0.5px_rgb(0_0_0/4%),0_1px_1px_rgb(0_0_0/8%),0_6px_14px_rgb(0_30_80/24%)] group-data-disabled:shadow-none motion-reduce:transition-none'

function SwitchThumb(props: { checked: boolean; pressed: boolean }) {
  const ref = useRef<HTMLSpanElement>(null)
  const targetX = props.checked
    ? props.pressed
      ? THUMB_METRICS.pressedCheckedX
      : THUMB_METRICS.checkedX
    : 0
  const targetWidth = props.pressed
    ? THUMB_METRICS.pressedWidth
    : THUMB_METRICS.width

  const [values] = useState(() => ({
    width: motionValue(targetWidth),
    x: motionValue(targetX),
  }))

  const [staticThumbStyle] = useState(
    () =>
      ({
        '--switch-x': `${targetX}px`,
        width: targetWidth,
      }) as CSSProperties,
  )

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const unsubscribeX = values.x.on('change', (x) => {
      el.style.setProperty('--switch-x', `${x}px`)
    })
    const unsubscribeWidth = values.width.on('change', (width) => {
      el.style.setProperty('width', `${width}px`)
    })
    return () => {
      unsubscribeX()
      unsubscribeWidth()
    }
  }, [values])

  useEffect(() => {
    const reduceMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const transition = reduceMotion ? { duration: 0 } : THUMB_SPRING
    const animations = [
      animate(values.x, targetX, transition),
      animate(values.width, targetWidth, transition),
    ]
    return () => {
      for (const animation of animations) animation.stop()
    }
  }, [values, targetX, targetWidth])

  return (
    <BaseSwitch.Thumb
      className={SWITCH_THUMB_CLASS}
      ref={ref}
      style={staticThumbStyle}
    />
  )
}

export function Switch(props: {
  'aria-label'?: string
  checked: boolean
  className?: string
  disabled?: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  const [pressed, setPressed] = useState(false)
  const interactive = !props.disabled

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (interactive && event.button === 0) setPressed(true)
  }

  const handlePointerRelease = () => setPressed(false)

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === ' ' && interactive) setPressed(true)
  }

  const handleKeyUp = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === ' ') setPressed(false)
  }

  return (
    <BaseSwitch.Root
      aria-label={props['aria-label']}
      checked={props.checked}
      className={cn(SWITCH_ROOT_CLASS, props.className)}
      disabled={props.disabled}
      onCheckedChange={props.onCheckedChange}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onPointerCancel={handlePointerRelease}
      onPointerDown={handlePointerDown}
      onPointerLeave={handlePointerRelease}
      onPointerUp={handlePointerRelease}
    >
      <SwitchThumb checked={props.checked} pressed={pressed} />
    </BaseSwitch.Root>
  )
}

interface FormSwitchProps {
  bordered?: boolean
  checked: boolean
  className?: string
  description?: ReactNode
  disabled?: boolean
  label: ReactNode
  onCheckedChange: (checked: boolean) => void
}

export function FormSwitch(props: FormSwitchProps) {
  return (
    <label
      className={cn(
        'flex items-center justify-between gap-4 text-sm',
        props.bordered
          ? 'rounded-sm border border-border bg-surface-card px-3 py-2'
          : null,
        props.className,
        props.disabled && 'opacity-60',
      )}
    >
      <span className="min-w-0">
        <span className="block text-fg">{props.label}</span>
        {props.description ? (
          <span className="mt-0.5 block text-xs text-fg-muted">
            {props.description}
          </span>
        ) : null}
      </span>
      <Switch
        checked={props.checked}
        disabled={props.disabled}
        onCheckedChange={props.onCheckedChange}
      />
    </label>
  )
}
