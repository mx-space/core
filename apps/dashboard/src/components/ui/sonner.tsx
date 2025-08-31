import { Toaster as Sonner } from 'sonner'

import { useThemeAtomValue } from '~/hooks/common'

type ToasterProps = React.ComponentProps<typeof Sonner>

export const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useThemeAtomValue()

  return (
    <Sonner
      theme={theme}
      richColors
      expand
      closeButton
      duration={3500}
      offset="16px"
      className="toaster group"
      toastOptions={{
        classNames: {
          // Card shell
          toast:
            'group pointer-events-auto flex gap-3 rounded-xl border border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70 shadow-lg shadow-black/5 ring-1 ring-border',
          // Title & description
          title: 'text-text font-medium',
          description: 'text-text-tertiary text-sm leading-relaxed',
          // Icon & close button
          icon: 'text-accent size-4',
          closeButton:
            'text-text-quaternary hover:text-text transition-opacity duration-200',
          // Action buttons
          actionButton:
            'rounded-md bg-accent text-background px-2.5 py-1 text-xs font-medium hover:bg-accent/90',
          cancelButton:
            'rounded-md border border-border bg-fill px-2.5 py-1 text-xs font-medium text-text hover:bg-fill-secondary',
        },
      }}
      {...props}
    />
  )
}
