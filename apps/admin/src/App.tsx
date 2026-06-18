import { useEffect } from 'react'
import { RouterProvider } from 'react-router/dom'

import { AppProviders } from './providers'
import { appRouter } from './router'
import { installThemeTokens } from './theme'

function App() {
  useEffect(() => {
    installThemeTokens()
  }, [])

  return (
    <AppProviders>
      <RouterProvider router={appRouter} />
    </AppProviders>
  )
}

export default App
