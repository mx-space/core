import { useEffect, useState } from 'react'

export type LayoutType = 'mobile' | 'tablet' | 'desktop'

interface ResponsiveConfig {
  mobile: {
    sidebar: 'hidden'
    navigation: 'bottom'
    content: 'full-width'
    drawer: 'overlay'
  }
  tablet: {
    sidebar: 'collapsible'
    navigation: 'sidebar'
    content: 'with-sidebar'
    drawer: 'none'
  }
  desktop: {
    sidebar: 'always-visible'
    navigation: 'sidebar'
    content: 'with-sidebar'
    drawer: 'none'
  }
}

export const breakpoints = {
  mobile: { max: '767px' },
  tablet: { min: '768px', max: '1199px' },
  desktop: { min: '1200px' },
} as const

export const useResponsiveLayout = () => {
  const [layout, setLayout] = useState<LayoutType>('desktop')

  useEffect(() => {
    const mediaQueries = {
      mobile: window.matchMedia('(max-width: 767px)'),
      tablet: window.matchMedia('(min-width: 768px) and (max-width: 1199px)'),
      desktop: window.matchMedia('(min-width: 1200px)'),
    }

    const updateLayout = () => {
      if (mediaQueries.mobile.matches) {
        setLayout('mobile')
      } else if (mediaQueries.tablet.matches) {
        setLayout('tablet')
      } else {
        setLayout('desktop')
      }
    }

    // Initial layout detection
    updateLayout()

    // Listen to changes
    Object.values(mediaQueries).forEach((mq) => {
      mq.addEventListener('change', updateLayout)
    })

    return () => {
      Object.values(mediaQueries).forEach((mq) => {
        mq.removeEventListener('change', updateLayout)
      })
    }
  }, [])

  return layout
}

export const responsiveConfig: ResponsiveConfig = {
  mobile: {
    sidebar: 'hidden',
    navigation: 'bottom',
    content: 'full-width',
    drawer: 'overlay',
  },
  tablet: {
    sidebar: 'collapsible',
    navigation: 'sidebar',
    content: 'with-sidebar',
    drawer: 'none',
  },
  desktop: {
    sidebar: 'always-visible',
    navigation: 'sidebar',
    content: 'with-sidebar',
    drawer: 'none',
  },
}
