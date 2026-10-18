import { act, type ComponentType } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { I18nProvider } from '~/i18n'
import { present } from '~/ui/feedback/modal-imperative'

import {
  presentEnableBackupEncryption,
  presentRestoreBackupKey,
} from './BackupKeyModals'

const modal = vi.hoisted(() => ({ close: vi.fn(), dismiss: vi.fn() }))
vi.mock('~/ui/feedback/modal-imperative', () => ({
  useModal: () => modal,
  present: vi.fn(),
}))
vi.mock('~/ui/feedback/modal', () => ({
  ModalHeader: ({ title }: { title: string }) => <h2>{title}</h2>,
}))
vi.mock('~/ui/primitives/checkbox', () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
    label,
  }: {
    checked: boolean
    onCheckedChange: (value: boolean) => void
    label: string
  }) => (
    <label>
      <input
        type="checkbox"
        role="checkbox"
        checked={checked}
        onChange={(event) => onCheckedChange(event.target.checked)}
      />
      {label}
    </label>
  ),
}))
vi.mock('../utils/backup-key', () => ({
  generateBackupKeyPair: async () => ({
    publicKey: 'public-only',
    privateKey: 'private-recovery-key',
  }),
}))

let root: Root
beforeEach(() => {
  vi.clearAllMocks()
  const container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  document.body.innerHTML = ''
})

async function mountPresentedModal() {
  const [Component, props] = vi.mocked(present).mock.calls[0] as [
    ComponentType<any>,
    object,
  ]
  await act(async () =>
    root.render(
      <I18nProvider>
        <Component {...props} />
      </I18nProvider>,
    ),
  )
}

it('requires confirmation that the recovery key was saved, then returns only the public key', async () => {
  presentEnableBackupEncryption()
  await mountPresentedModal()
  expect(document.querySelector('pre')?.textContent).toBe(
    'private-recovery-key',
  )
  const enable = [...document.querySelectorAll('button')].find(
    (button) => button.textContent === '启用加密',
  )!
  expect(enable.disabled).toBe(true)
  await act(async () =>
    (document.querySelector('[role=checkbox]') as HTMLElement).click(),
  )
  expect(enable.disabled).toBe(false)
  await act(async () => enable.click())
  expect(modal.close).toHaveBeenCalledWith('public-only')
  expect(JSON.stringify(modal.close.mock.calls)).not.toContain(
    'private-recovery-key',
  )
})

it('keeps the restore dialog open after a bad key and supports retry without reselecting the backup', async () => {
  const restore = vi
    .fn()
    .mockRejectedValueOnce(new Error('wrong key'))
    .mockResolvedValueOnce(undefined)
  presentRestoreBackupKey(restore)
  await mountPresentedModal()
  const input = document.querySelector('textarea')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value',
    )!.set!.call(input, ' saved-key ')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  const submit = async () =>
    act(async () => {
      document
        .querySelector('form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })
  await submit()
  expect(restore).toHaveBeenCalledWith('saved-key')
  expect(document.querySelector('[role=alert]')?.textContent).toBe('wrong key')
  expect(modal.close).not.toHaveBeenCalled()
  await submit()
  expect(modal.close).toHaveBeenCalledTimes(1)
})
