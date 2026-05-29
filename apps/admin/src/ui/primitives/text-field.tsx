import { Field } from '@base-ui/react/field'
import { Input as BaseInput } from '@base-ui/react/input'
import { forwardRef } from 'react'
import type {
  ComponentPropsWithoutRef,
  CSSProperties,
  FocusEventHandler,
  KeyboardEventHandler,
  ReactNode,
} from 'react'

import { cn } from '~/utils/cn'

type TextInputType = ComponentPropsWithoutRef<'input'>['type']

interface TextInputProps {
  autoComplete?: string
  autoFocus?: boolean
  className?: string
  controlClassName?: string
  disabled?: boolean
  id?: string
  inputMode?: ComponentPropsWithoutRef<'input'>['inputMode']
  label?: ReactNode
  labelClassName?: string
  list?: string
  maxLength?: number
  max?: ComponentPropsWithoutRef<'input'>['max']
  min?: ComponentPropsWithoutRef<'input'>['min']
  name?: string
  onBlur?: FocusEventHandler<HTMLInputElement>
  onChange: (value: string) => void
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>
  placeholder?: string
  required?: boolean
  spellCheck?: boolean
  step?: ComponentPropsWithoutRef<'input'>['step']
  style?: CSSProperties
  type?: TextInputType
  value: string
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  function TextInput(props, ref) {
    const control = (
      <BaseInput
        autoComplete={props.autoComplete}
        autoFocus={props.autoFocus}
        className={cn(
          'outline-hidden h-10 w-full rounded border border-neutral-200 bg-white px-3 text-sm text-neutral-900 transition-colors placeholder:text-neutral-400 focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-shallow)] disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100',
          props.controlClassName,
        )}
        disabled={props.disabled}
        id={props.id}
        inputMode={props.inputMode}
        list={props.list}
        max={props.max}
        maxLength={props.maxLength}
        min={props.min}
        name={props.name}
        onBlur={props.onBlur}
        onKeyDown={props.onKeyDown}
        onValueChange={props.onChange}
        placeholder={props.placeholder}
        ref={ref}
        required={props.required}
        spellCheck={props.spellCheck}
        step={props.step}
        style={props.style}
        type={props.type ?? 'text'}
        value={props.value}
      />
    )

    if (!props.label) {
      return (
        <Field.Root className={cn('contents', props.className)}>
          {control}
        </Field.Root>
      )
    }

    return (
      <Field.Root className={cn('grid gap-1.5 text-sm', props.className)}>
        <Field.Label
          className={cn(
            'font-medium text-neutral-700 dark:text-neutral-300',
            props.labelClassName,
          )}
        >
          {props.label}
          {props.required ? <span className="text-red-500"> *</span> : null}
        </Field.Label>
        {control}
      </Field.Root>
    )
  },
)

interface TextAreaProps {
  autoFocus?: boolean
  className?: string
  controlClassName?: string
  disabled?: boolean
  label?: ReactNode
  labelClassName?: string
  maxLength?: number
  name?: string
  onBlur?: FocusEventHandler<HTMLTextAreaElement>
  onChange: (value: string) => void
  onKeyDown?: KeyboardEventHandler<HTMLTextAreaElement>
  placeholder?: string
  required?: boolean
  spellCheck?: boolean
  style?: CSSProperties
  value: string
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  function TextArea(props, ref) {
    const control = (
      <textarea
        autoFocus={props.autoFocus}
        className={cn(
          'outline-hidden min-h-24 w-full rounded border border-neutral-200 bg-white px-3 py-2 text-sm leading-6 text-neutral-900 transition-colors placeholder:text-neutral-400 focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-shallow)] disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100',
          props.controlClassName,
        )}
        disabled={props.disabled}
        maxLength={props.maxLength}
        name={props.name}
        onBlur={props.onBlur}
        onChange={(event) => props.onChange(event.target.value)}
        onKeyDown={props.onKeyDown}
        placeholder={props.placeholder}
        ref={ref}
        required={props.required}
        spellCheck={props.spellCheck}
        style={props.style}
        value={props.value}
      />
    )

    if (!props.label) return control

    return (
      <Field.Root className={cn('grid gap-1.5 text-sm', props.className)}>
        <Field.Label
          className={cn(
            'font-medium text-neutral-700 dark:text-neutral-300',
            props.labelClassName,
          )}
        >
          {props.label}
          {props.required ? <span className="text-red-500"> *</span> : null}
        </Field.Label>
        {control}
      </Field.Root>
    )
  },
)
