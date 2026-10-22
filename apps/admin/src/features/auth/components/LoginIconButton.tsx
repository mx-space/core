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
      className="!size-10 rounded-full !p-0 focus-visible:ring-accent/30"
      onClick={props.onClick}
      type="button"
      variant="subtle"
    >
      {props.children}
    </Button>
  )
}
