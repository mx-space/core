import './styles/index.css'

import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'

import { router } from './router'

const $container = document.querySelector('#root') as HTMLElement

if (import.meta.env.DEV) {
  const { start } = await import('react-scan')
  start()
}
createRoot($container).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
