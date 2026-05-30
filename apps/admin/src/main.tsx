import './index.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App'
import { migrateLegacyProviderType } from './bootstrap/migrate-legacy-provider-type'

migrateLegacyProviderType()

const appRoot = createRootElement()

// Fade out initial loader before mounting
const loader = document.getElementById('initial-loader')
if (loader) {
  loader.classList.add('fade-out')
  setTimeout(() => {
    mountApp(appRoot)
  }, 200)
} else {
  mountApp(appRoot)
}

if (__DEV__) {
  window.app = appRoot
}

// cjs webpack compatibility
// @ts-ignore
window.global = window
// @ts-ignore
window.process = {
  env: {},
}
// @ts-ignore
window.module = {
  exports: {},
}

declare global {
  interface JSON {
    safeParse: typeof JSON.parse
  }
}
JSON.safeParse = (...rest) => {
  try {
    return JSON.parse(...rest)
  } catch {
    return null
  }
}

function createRootElement() {
  const rootElement = document.getElementById('app')

  if (!rootElement) {
    throw new Error('Missing #app root element')
  }

  return createRoot(rootElement)
}

function mountApp(root: ReturnType<typeof createRoot>) {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
