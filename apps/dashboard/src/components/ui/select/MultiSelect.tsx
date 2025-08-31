import { AnimatePresence, m } from 'motion/react'
import type { FC } from 'react'
import * as React from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { clsxm as cn, focusRing } from '~/lib/cn'
import { Spring } from '~/lib/spring'

interface MultiSelectProps {
  value?: string[]
  onChange?: (value: string[]) => void
  placeholder?: string
  options?: string[]
  allowCustom?: boolean
  disabled?: boolean
  size?: 'default' | 'sm'
  className?: string
  label?: string
  maxHeight?: string
}

const DEFAULT_VALUE: string[] = []
const DEFAULT_OPTIONS: string[] = []

export const MultiSelect: FC<MultiSelectProps> = ({
  value = DEFAULT_VALUE,
  onChange,
  placeholder = 'Select tags...',
  options = DEFAULT_OPTIONS,
  allowCustom = true,
  disabled = false,
  size = 'default',
  className,
  label,
  maxHeight = 'max-h-48',
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [customValue, setCustomValue] = useState('')
  const containerRef = useRef<HTMLDivElement | null>(null)

  const handleToggleOption = useCallback(
    (option: string) => {
      const newValue = value.includes(option)
        ? value.filter((v) => v !== option)
        : [...value, option]
      onChange?.(newValue)
    },
    [value, onChange],
  )

  const handleAddCustom = useCallback(() => {
    if (customValue.trim() && !value.includes(customValue.trim())) {
      onChange?.([...value, customValue.trim()])
      setCustomValue('')
    }
  }, [customValue, value, onChange])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleAddCustom()
      }
    },
    [handleAddCustom],
  )

  const handleRemoveTag = useCallback(
    (tag: string) => {
      onChange?.(value.filter((v) => v !== tag))
    },
    [value, onChange],
  )

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return
    const handlePointerDown = (e: MouseEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [isOpen])

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      {label && (
        <label className="mb-2 block text-sm font-medium text-text">
          {label}
        </label>
      )}

      {/* Selected tags display */}
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {value.map((tag) => (
            <span
              key={tag}
              className="bg-accent/10 text-accent inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs"
            >
              {tag}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                className="text-accent/70 hover:text-accent ml-1 inline-flex size-3 items-center justify-center rounded-full hover:bg-accent/20"
              >
                <i className="i-mingcute-close-line size-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Trigger button (aligned with SelectTrigger) */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        disabled={disabled}
        className={cn(
          'flex w-full items-center justify-between whitespace-nowrap rounded-lg bg-transparent',
          focusRing,
          'outline-none transition-all duration-200',
          'border-border hover:border-fill border',
          size === 'sm' ? 'h-8 px-3 text-sm' : 'h-9 px-3.5 py-2 text-sm',
          'placeholder:text-text-secondary',
          'disabled:cursor-not-allowed disabled:opacity-50',
          '[&>span]:line-clamp-1',
          'shadow-zinc-100 dark:shadow-zinc-800 shadow-sm hover:shadow',
          disabled && 'cursor-not-allowed opacity-30',
        )}
      >
        <span
          className={cn('text-text-secondary', value.length > 0 && 'text-text')}
        >
          {value.length > 0 ? `${value.length} selected` : placeholder}
        </span>
        <i
          className={cn(
            'i-mingcute-down-line -mr-1 ml-2 text-text-secondary size-4 shrink-0 opacity-60 transition-transform duration-200',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {/* Dropdown content with motion (aligned with popover styles) */}
      <AnimatePresence>
        {isOpen && (
          <m.div
            key="multi-select-content"
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            transition={Spring.presets.smooth}
            className={cn(
              'bg-material-medium backdrop-blur-background absolute z-[60] mt-1 w-full overflow-hidden rounded-[6px] border border-border p-1 shadow-context-menu',
              maxHeight,
            )}
          >
            <div className="overflow-y-auto">
              {/* Custom input */}
              {allowCustom && (
                <div className="border-border border-b p-2">
                  <div className="flex gap-1">
                    <Input
                      value={customValue}
                      onChange={(e) => setCustomValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Add custom tag..."
                    />
                    <Button
                      size="sm"
                      onClick={handleAddCustom}
                      disabled={
                        !customValue.trim() ||
                        value.includes(customValue.trim())
                      }
                    >
                      Add
                    </Button>
                  </div>
                </div>
              )}

              {/* Options */}
              <div className="py-1">
                {options.length === 0 ? (
                  <div className="px-2.5 py-2 text-sm text-text-secondary">
                    No tags available
                  </div>
                ) : (
                  options.map((option) => {
                    const selected = value.includes(option)
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => handleToggleOption(option)}
                        className={cn(
                          'cursor-menu relative flex w-full select-none items-center rounded-[5px] px-2.5 py-1 text-left text-sm outline-none',
                          'h-[28px]',
                          selected
                            ? 'bg-accent/10 text-accent'
                            : 'hover:bg-accent hover:text-white focus:bg-accent focus:text-white',
                        )}
                      >
                        <span className="pr-5">{option}</span>
                        {selected && (
                          <span className="absolute right-2 flex size-3.5 items-center justify-center">
                            <i className="i-mingcute-check-fill size-3" />
                          </span>
                        )}
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            {/* Close button */}
            <div className="border-border border-t p-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsOpen(false)}
                className="w-full"
              >
                Close
              </Button>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}
