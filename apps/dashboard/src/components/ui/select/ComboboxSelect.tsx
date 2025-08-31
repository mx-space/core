import * as SelectPrimitive from '@radix-ui/react-select'
import type { FC } from 'react'
import * as React from 'react'
import { useCallback, useState } from 'react'

import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { clsxm, focusRing } from '~/lib/cn'

import { RootPortal } from '../portal/RootPortal'
import { SelectItem, SelectSeparator } from './Select'

interface ComboboxSelectProps {
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  options?: string[]
  allowCustom?: boolean
  disabled?: boolean
  size?: 'default' | 'sm'
  className?: string
  label?: string
}

const DEFAULT_OPTIONS: string[] = []

export const ComboboxSelect: FC<ComboboxSelectProps> = ({
  value,
  onValueChange,
  placeholder = 'Select an option...',
  options = DEFAULT_OPTIONS,
  allowCustom = true,
  disabled = false,
  size = 'default',
  className,
  label,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [customValue, setCustomValue] = useState('')
  const [isAddingCustom, setIsAddingCustom] = useState(false)

  const handleValueChange = useCallback(
    (newValue: string) => {
      if (newValue === '__ADD_CUSTOM__') {
        setIsAddingCustom(true)
        return
      }
      // Convert special empty placeholder back to empty string
      const actualValue = newValue === '__EMPTY__' ? '' : newValue
      onValueChange?.(actualValue)
      setIsOpen(false)
    },
    [onValueChange],
  )

  const handleAddCustom = useCallback(() => {
    if (customValue.trim()) {
      onValueChange?.(customValue.trim())
      setCustomValue('')
      setIsAddingCustom(false)
      setIsOpen(false)
    }
  }, [customValue, onValueChange])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleAddCustom()
      } else if (e.key === 'Escape') {
        setIsAddingCustom(false)
        setCustomValue('')
      }
    },
    [handleAddCustom],
  )

  return (
    <div className="w-full">
      {label && (
        <label className="mb-2 block text-sm font-medium text-text">
          {label}
        </label>
      )}
      <SelectPrimitive.Root
        value={value === '' ? '__EMPTY__' : value}
        onValueChange={handleValueChange}
        open={isOpen}
        onOpenChange={setIsOpen}
        disabled={disabled}
      >
        <SelectPrimitive.Trigger
          className={clsxm(
            'flex w-full items-center justify-between whitespace-nowrap rounded-lg bg-transparent',
            focusRing,
            'outline-none transition-all duration-200',
            'border-border hover:border-fill border',
            size === 'sm' ? 'h-8 px-3 text-sm' : 'h-9 px-3.5 py-2 text-sm',
            'placeholder:text-text-secondary',
            'disabled:cursor-not-allowed disabled:opacity-50',
            '[&>span]:line-clamp-1',
            'shadow-zinc-100 dark:shadow-zinc-800 shadow-sm hover:shadow',
            className,
            disabled && 'cursor-not-allowed opacity-30',
          )}
        >
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon asChild>
            <i className="i-mingcute-down-line -mr-1 ml-2 text-text-secondary size-4 shrink-0 opacity-60 transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>

        <RootPortal>
          <SelectPrimitive.Content
            className={clsxm(
              'bg-material-medium backdrop-blur-background text-text z-[60] max-h-96 min-w-32 overflow-hidden rounded-[6px] border border-border p-1',
              'shadow-context-menu',
            )}
            position="popper"
          >
            <SelectPrimitive.Viewport className="p-0">
              {isAddingCustom && allowCustom ? (
                <div className="p-2 space-y-2">
                  <Input
                    value={customValue}
                    onChange={(e) => setCustomValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter custom value..."
                    autoFocus
                  />
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      onClick={handleAddCustom}
                      disabled={!customValue.trim()}
                    >
                      Add
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setIsAddingCustom(false)
                        setCustomValue('')
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {options.length === 0 && !allowCustom ? (
                    <div className="px-2.5 py-1 text-sm text-text-secondary">
                      No options available
                    </div>
                  ) : (
                    <>
                      {options.map((option) => (
                        <SelectItem
                          key={option || '__EMPTY__'}
                          value={option || '__EMPTY__'}
                        >
                          {option || 'No category'}
                        </SelectItem>
                      ))}

                      {allowCustom && (
                        <>
                          {options.length > 0 && <SelectSeparator />}
                          <SelectItem value="__ADD_CUSTOM__">
                            <span className="flex items-center gap-2">
                              <i className="i-mingcute-add-line size-3" />
                              Add custom...
                            </span>
                          </SelectItem>
                        </>
                      )}
                    </>
                  )}
                </>
              )}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </RootPortal>
      </SelectPrimitive.Root>
    </div>
  )
}
