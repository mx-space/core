import { useEffect, useState } from 'react'

export type LayoutMode = 'desktop' | 'tablet' | 'mobile'

export const useResponsiveLayout = () => {
  const [layout, setLayout] = useState<LayoutMode>('desktop')

  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 767px)')
    const tablet = window.matchMedia(
      '(min-width: 768px) and (max-width: 1199px)',
    )
    const desktop = window.matchMedia('(min-width: 1200px)')

    const update = () => {
      if (mobile.matches) setLayout('mobile')
      else if (tablet.matches) setLayout('tablet')
      else if (desktop.matches) setLayout('desktop')
    }

    update()
    mobile.addEventListener('change', update)
    tablet.addEventListener('change', update)
    desktop.addEventListener('change', update)
    return () => {
      mobile.removeEventListener('change', update)
      tablet.removeEventListener('change', update)
      desktop.removeEventListener('change', update)
    }
  }, [])

  return layout
}
