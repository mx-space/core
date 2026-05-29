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
      className="!size-10 rounded-full border-white/10 bg-white/15 !p-0 text-white/80 backdrop-blur-sm hover:bg-white/25 hover:text-white focus-visible:ring-white/50 dark:border-white/10 dark:bg-white/15 dark:text-white/80 dark:hover:bg-white/25"
      onClick={props.onClick}
      type="button"
      variant="subtle"
    >
      {props.children}
    </Button>
  )
}
