'use client'

import type { HTMLMotionProps, SpringOptions, Transition } from 'motion/react'
import { m as motion, useMotionValue, useSpring } from 'motion/react'
import * as React from 'react'

import { useIsDark } from '~/hooks/common'
import { clsxm as cn } from '~/lib/cn'

type StarLayerProps = HTMLMotionProps<'div'> & {
  count: number
  size: number
  transition: Transition
}

function generateStars(count: number, starColor: string) {
  const shadows: string[] = []
  for (let i = 0; i < count; i++) {
    const x = Math.floor(Math.random() * 4000) - 2000
    const y = Math.floor(Math.random() * 4000) - 2000
    shadows.push(`${x}px ${y}px ${starColor}`)
  }
  return shadows.join(', ')
}

const defaultTransition: Transition = {
  repeat: Infinity,
  duration: 50,
  ease: 'linear',
}
function StarLayer({
  count = 1000,
  size = 1,
  transition = defaultTransition,

  className,
  ...props
}: StarLayerProps) {
  const [boxShadow, setBoxShadow] = React.useState<string>('')

  const isdark = useIsDark()
  const starColor = isdark ? '#fff' : '#000'
  React.useEffect(() => {
    setBoxShadow(generateStars(count, starColor))
  }, [count, starColor])

  return (
    <motion.div
      data-slot="star-layer"
      animate={{ y: [0, -2000] }}
      transition={transition}
      className={cn('absolute top-0 left-0 w-full h-[2000px]', className)}
      {...props}
    >
      <div
        className="absolute bg-transparent rounded-full"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          boxShadow,
        }}
      />
      <div
        className="absolute bg-transparent rounded-full top-[2000px]"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          boxShadow,
        }}
      />
    </motion.div>
  )
}

type StarsBackgroundProps = React.ComponentProps<'div'> & {
  factor?: number
  speed?: number
  transition?: SpringOptions
  starColor?: string
  pointerEvents?: boolean
}

function StarsBackground({
  children,
  className,
  factor = 0.05,
  speed = 50,
  transition = { stiffness: 50, damping: 20 },

  pointerEvents = true,
  ...props
}: StarsBackgroundProps) {
  const offsetX = useMotionValue(1)
  const offsetY = useMotionValue(1)

  const springX = useSpring(offsetX, transition)
  const springY = useSpring(offsetY, transition)

  const handleMouseMove = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      const centerX = window.innerWidth / 2
      const centerY = window.innerHeight / 2
      const newOffsetX = -(e.clientX - centerX) * factor
      const newOffsetY = -(e.clientY - centerY) * factor
      offsetX.set(newOffsetX)
      offsetY.set(newOffsetY)
    },
    [offsetX, offsetY, factor],
  )

  const isDark = useIsDark()
  if (!isDark) {
    return null
  }
  return (
    <div
      data-slot="stars-background"
      className={cn(
        'relative size-full overflow-hidden bg-material-dark2 dark:bg-[radial-gradient(ellipse_at_bottom,_#262626_0%,_#000_100%)]',
        className,
      )}
      onMouseMove={handleMouseMove}
      {...props}
    >
      <motion.div
        style={{ x: springX, y: springY }}
        className={cn({ 'pointer-events-none': !pointerEvents })}
      >
        <StarLayer
          count={1000}
          size={1}
          transition={{ repeat: Infinity, duration: speed, ease: 'linear' }}
        />
        <StarLayer
          count={400}
          size={2}
          transition={{
            repeat: Infinity,
            duration: speed * 2,
            ease: 'linear',
          }}
        />
        <StarLayer
          count={200}
          size={3}
          transition={{
            repeat: Infinity,
            duration: speed * 3,
            ease: 'linear',
          }}
        />
      </motion.div>
      {children}
    </div>
  )
}

export {
  StarLayer,
  type StarLayerProps,
  StarsBackground,
  type StarsBackgroundProps,
}
