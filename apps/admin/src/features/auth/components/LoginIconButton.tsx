import type { ReactNode } from 'react'

import { Button } from '~/ui/primitives/button'

export function LoginIconButton(props: {
  children: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <Button
      aria-label={props.label}
      iconOnly
      onClick={props.onClick}
      title={props.label}
      type="button"
      variant="secondary"
    >
      {props.children}
    </Button>
  )
}
