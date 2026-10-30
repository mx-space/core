import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'

import { I18nProvider } from '~/i18n'

import { AuthExperience, AuthScene } from './AuthExperience'

let root: Root | undefined
let container: HTMLDivElement | undefined

afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
})

describe('AuthExperience', () => {
  it('keeps the same canvas when the current form and scene change', () => {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    act(() =>
      root!.render(
        <I18nProvider>
          <AuthExperience initialScene="login">
            <AuthScene scene="login">
              <h1>Login</h1>
            </AuthScene>
          </AuthExperience>
        </I18nProvider>,
      ),
    )
    const canvas = container.querySelector('canvas')
    expect(canvas).not.toBeNull()
    act(() =>
      root!.render(
        <I18nProvider>
          <AuthExperience initialScene="login">
            <AuthScene scene="site">
              <h1>Your site</h1>
            </AuthScene>
          </AuthExperience>
        </I18nProvider>,
      ),
    )
    expect(container.querySelector('canvas')).toBe(canvas)
    expect(
      container
        .querySelector('[data-auth-scene]')
        ?.getAttribute('data-auth-scene'),
    ).toBe('site')
    expect(container.querySelector('h1')?.textContent).toBe('Your site')
  })
})
