import type { PropsWithChildren } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { tinykeys } from 'tinykeys'
import { appRoutes } from 'virtual:admin-routes'

import { useI18n } from '~/i18n'

import type { CommandPaletteItem } from './CommandPalette'
import { CommandPalette } from './CommandPalette'

export function CommandPaletteProvider({ children }: PropsWithChildren) {
  const navigate = useNavigate()
  const { t } = useI18n()
  const [open, setOpen] = useState(false)

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    return tinykeys(window, {
      '$mod+KeyK': (event) => {
        event.preventDefault()
        setOpen((value) => !value)
      },
    })
  }, [])

  const items = useMemo<CommandPaletteItem[]>(() => {
    return appRoutes
      .filter(
        (route) =>
          !!route.titleKey &&
          !route.hidden &&
          !route.path.includes(':') &&
          !route.path.includes('*'),
      )
      .map((route) => ({
        id: route.path,
        name: route.titleKey ? t(route.titleKey) : route.path,
        subtitle: route.path,
        keywords: route.descriptionKey ? [t(route.descriptionKey)] : undefined,
        icon: route.icon,
        perform: () => navigate(route.path),
      }))
  }, [navigate, t])

  return (
    <>
      {children}
      <CommandPalette items={items} onClose={close} open={open} />
    </>
  )
}
