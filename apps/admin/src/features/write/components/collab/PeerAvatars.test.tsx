import { act, createElement } from 'react'
import type { Root } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { I18nProvider } from '~/i18n'

import type { RemotePresence } from '../../crdt/collab-presence'
import { PeerAvatars } from './PeerAvatars'

let container: HTMLDivElement
let root: Root

const peer = (key: string, name: string, id = 'owner'): RemotePresence => ({
  anchor: null,
  color: '#0090ff',
  focus: null,
  key,
  user: { avatar: null, id, name },
})

const render = (peers: RemotePresence[]) =>
  act(() => {
    root.render(
      createElement(
        I18nProvider,
        null,
        createElement(PeerAvatars, { peers, selfId: 'owner' }),
      ),
    )
  })

beforeEach(() => {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  document.body.innerHTML = ''
})

describe('PeerAvatars', () => {
  it('renders nothing when nobody else is here', () => {
    render([])

    expect(container.textContent).toBe('')
  })

  it('shows up to four members and counts the rest', () => {
    render([
      peer('c1', 'Ann', 'r1'),
      peer('c2', 'Bob', 'r2'),
      peer('c3', 'Cid', 'r3'),
      peer('c4', 'Dee', 'r4'),
      peer('c5', 'Eve', 'r5'),
      peer('c6', 'Fay', 'r6'),
    ])

    expect(container.querySelectorAll('[data-peer]')).toHaveLength(4)
    expect(container.textContent).toContain('+2')
  })

  it('labels the owner’s own other tabs', () => {
    render([peer('c1', 'Owner')])

    const avatar = container.querySelector('[data-peer]')!
    expect(avatar.getAttribute('title')).toContain('Owner')
    expect(avatar.getAttribute('title')).toContain('另一个标签页')
  })
})
