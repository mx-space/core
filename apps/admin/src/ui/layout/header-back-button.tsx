import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router'

import { useI18n } from '~/i18n'
import { cn } from '~/utils/cn'

export interface HeaderBackButtonProps {
  className?: string
  label?: string
  onClick?: () => void
  to?: string
}

export function HeaderBackButton(props: HeaderBackButtonProps) {
  const navigate = useNavigate()
  const { t } = useI18n()
  const label = props.label ?? t('common.back')

  const handleClick = () => {
    if (props.onClick) {
      props.onClick()
      return
    }
    if (props.to) {
      navigate(props.to)
      return
    }
    navigate(-1)
  }

  return (
    <button
      aria-label={label}
      className={cn(
        'focus-visible:outline-hidden -ml-1.5 inline-flex size-9 shrink-0 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100 dark:focus-visible:ring-neutral-500 dark:focus-visible:ring-offset-neutral-900',
        props.className,
      )}
      onClick={handleClick}
      title={label}
      type="button"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
    </button>
  )
}
