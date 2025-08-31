'use client'

import type { HTMLMotionProps, MotionProps, Transition } from 'motion/react'
import { AnimatePresence, m } from 'motion/react'
import * as React from 'react'

import { clsxm } from '~/lib/cn'
import { Spring } from '~/lib/spring'

const sizes = {
  default: 'size-8 [&_svg]:size-5',
  sm: 'size-6 [&_svg]:size-4',
  md: 'size-10 [&_svg]:size-6',
  lg: 'size-12 [&_svg]:size-7',
}

const animations = {
  pulse: {
    initial: { scale: 1.2, opacity: 0 },
    animate: { scale: [1.2, 1.8, 1.2], opacity: [0, 0.3, 0] },
    transition: { duration: 1.2, ease: 'easeInOut' },
  },
  glow: {
    initial: { scale: 1, opacity: 0 },
    animate: { scale: [1, 1.5], opacity: [0.8, 0] },
    transition: { duration: 0.8, ease: 'easeOut' },
  },
  particle: (index: number) => ({
    initial: { x: '50%', y: '50%', scale: 0, opacity: 0 },
    animate: {
      x: `calc(50% + ${Math.cos((index * Math.PI) / 3) * 30}px)`,
      y: `calc(50% + ${Math.sin((index * Math.PI) / 3) * 30}px)`,
      scale: [0, 1, 0],
      opacity: [0, 1, 0],
    },
    transition: { duration: 0.8, delay: index * 0.05, ease: 'easeOut' },
  }),
} satisfies Record<string, MotionProps | ((index: number) => MotionProps)>

type IconButtonProps = Omit<HTMLMotionProps<'button'>, 'color'> & {
  icon: React.ElementType
  active?: boolean
  className?: string
  animate?: boolean
  size?: keyof typeof sizes
  color?: [number, number, number]
  transition?: Transition
}

const defaultColor = [59, 130, 246] as [number, number, number]

function IconButton({
  icon: Icon,
  className,
  active = false,
  animate = true,
  size = 'default',
  color = defaultColor,
  transition = Spring.presets.smooth,
  ...props
}: IconButtonProps) {
  return (
    <m.button
      data-slot="icon-button"
      className={clsxm(
        `group/icon-button relative inline-flex size-10 shrink-0 cursor-pointer rounded-full text-[var(--icon-button-color)] hover:bg-[var(--icon-button-color)]/10 active:bg-[var(--icon-button-color)]/20`,
        sizes[size],
        className,
      )}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      style={
        {
          '--icon-button-color': `rgb(${color[0]}, ${color[1]}, ${color[2]})`,
        } as React.CSSProperties
      }
      {...props}
    >
      <m.div
        className="stroke-material-medium absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 group-hover/icon-button:stroke-[var(--icon-button-color)]"
        aria-hidden="true"
      >
        <Icon
          className={
            active ? 'fill-[var(--icon-button-color)]' : 'fill-transparent'
          }
        />
      </m.div>

      <AnimatePresence mode="wait">
        {active && (
          <m.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 fill-[var(--icon-button-color)] text-[var(--icon-button-color)]"
            aria-hidden="true"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={transition}
          >
            <Icon />
          </m.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {animate && active && (
          <>
            <m.div
              className="absolute inset-0 z-10 rounded-full "
              style={{
                background: `radial-gradient(circle, rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.4) 0%, rgba(${color[0]}, ${color[1]}, ${color[2]}, 0) 70%)`,
              }}
              {...animations.pulse}
            />
            <m.div
              className="absolute inset-0 z-10 rounded-full"
              style={{
                boxShadow: `0 0 10px 2px rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.6)`,
              }}
              {...animations.glow}
            />
            {Array.from({ length: 6 }).map((_, i) => (
              <m.div
                key={i}
                className="absolute h-1 w-1 rounded-full bg-[var(--icon-button-color)]"
                initial={animations.particle(i).initial}
                animate={animations.particle(i).animate}
                transition={animations.particle(i).transition}
              />
            ))}
          </>
        )}
      </AnimatePresence>
    </m.button>
  )
}

export { IconButton, type IconButtonProps }
