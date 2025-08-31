import { m } from 'motion/react'
import type { ReactNode, Ref } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { cn } from '~/lib/cn'
import { Spring } from '~/lib/spring'

export interface SegmentTabItem<T = string> {
  value: T
  label: ReactNode
  icon?: ReactNode
}

export interface SegmentTabProps<T = string> {
  items: SegmentTabItem<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
  containerClassName?: string
  activeClassName?: string
  inactiveClassName?: string
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  responsiveWrap?: boolean
  ref?: Ref<HTMLDivElement>
}

const sizeClasses = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-2 text-sm',
  lg: 'px-4 py-3 text-base',
}
export function SegmentTab<T = string>({
  items,
  value,
  onChange,
  className,
  containerClassName,
  activeClassName,
  inactiveClassName,
  size = 'md',
  disabled = false,
  responsiveWrap = false,
  ref,
}: SegmentTabProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [indicatorStyle, setIndicatorStyle] = useState<{
    width: number
    left: number
  }>({ width: 0, left: 0 })

  const updateIndicator = useCallback(() => {
    if (!containerRef.current) return

    const activeIndex = items.findIndex((item) => item.value === value)
    if (activeIndex === -1) return

    const buttons = containerRef.current.querySelectorAll(
      '[data-segment-tab-item]',
    )
    const activeButton = buttons[activeIndex] as HTMLElement

    if (activeButton) {
      const containerRect = containerRef.current.getBoundingClientRect()
      const buttonRect = activeButton.getBoundingClientRect()

      setIndicatorStyle({
        width: buttonRect.width,
        left: buttonRect.left - containerRect.left,
      })
    }
  }, [items, value])

  useEffect(() => {
    const observer = new ResizeObserver(updateIndicator)
    if (containerRef.current) {
      observer.observe(containerRef.current)
    }
    updateIndicator()

    const timerId = setTimeout(() => {
      updateIndicator()
    }, 500)
    return () => {
      clearTimeout(timerId)
      observer.disconnect()
    }
  }, [updateIndicator])

  return (
    <div
      ref={ref}
      className={cn(
        'relative flex items-center gap-1 p-1 bg-fill rounded-lg container-type-[inline-size] w-full',
        disabled && 'opacity-50 pointer-events-none',
        containerClassName,
      )}
    >
      <div
        ref={containerRef}
        className={cn(
          'relative flex items-center gap-1 w-full',
          responsiveWrap && 'flex-wrap',
        )}
      >
        {/* 滑动指示器 */}
        <m.div
          className={cn(
            'absolute top-0 bg-background rounded-md shadow-sm pointer-events-none',
            responsiveWrap && 'hidden @[420px]:block',
            className,
          )}
          initial={false}
          animate={{
            width: indicatorStyle.width,
            left: indicatorStyle.left,
            height: '100%',
          }}
          transition={Spring.presets.smooth}
          style={{
            zIndex: 1,
          }}
        />

        {/* 标签按钮 */}
        {items.map((item) => {
          const isActive = item.value === value

          return (
            <button
              key={String(item.value)}
              type="button"
              data-segment-tab-item
              onClick={() => !disabled && onChange(item.value)}
              className={cn(
                'relative font-medium rounded-md transition-colors duration-200',
                'flex items-center justify-center gap-2 whitespace-nowrap',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20',
                sizeClasses[size],
                responsiveWrap
                  ? cn(
                      '@[0px]:basis-[calc(50%-0.125rem)] @[0px]:flex-none @[0px]:px-2',
                      '@[420px]:basis-auto @[420px]:flex-1 @[420px]:px-3',
                    )
                  : cn('flex-1', '@[0px]:px-2 @[420px]:px-3'),
                isActive
                  ? cn('text-text', activeClassName)
                  : cn(
                      'text-text-secondary hover:text-text',
                      !disabled && 'hover:bg-fill-secondary/50',
                      inactiveClassName,
                    ),
              )}
              style={{ zIndex: 2 }}
              disabled={disabled}
            >
              {item.icon && (
                <span className="flex items-center justify-center">
                  {item.icon}
                </span>
              )}
              <span
                className={cn(
                  !responsiveWrap && '@[0px]:hidden @[420px]:inline',
                )}
              >
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
