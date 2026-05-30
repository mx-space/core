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
        'focus-visible:outline-hidden -ml-1.5 inline-flex size-9 shrink-0 items-center justify-center rounded-sm text-fg-muted transition-colors hover:bg-surface-inset hover:text-fg focus-visible:ring-[3px] focus-visible:ring-accent/15',
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
