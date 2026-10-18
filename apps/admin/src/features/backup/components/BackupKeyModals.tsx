import { Copy, Download, Loader2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { useI18n } from '~/i18n'
import { ModalHeader } from '~/ui/feedback/modal'
import { present, useModal } from '~/ui/feedback/modal-imperative'
import { Button } from '~/ui/primitives/button'
import { Checkbox } from '~/ui/primitives/checkbox'
import { TextArea } from '~/ui/primitives/text-field'

import { generateBackupKeyPair } from '../utils/backup-key'

function SaveBackupKeyModal() {
  const { t } = useI18n()
  const modal = useModal<string>()
  const [keys, setKeys] = useState<{ publicKey: string; privateKey: string }>()
  const [saved, setSaved] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    void generateBackupKeyPair().then(
      (value) => {
        if (active) setKeys(value)
      },
      () => {
        if (active) setFailed(true)
      },
    )
    return () => {
      active = false
    }
  }, [])

  return (
    <div>
      <ModalHeader title={t('backup.key.saveTitle')} showClose={false} />
      <div className="space-y-4 px-5 py-4">
        <p className="text-sm text-fg-muted">
          {t('backup.key.saveDescription')}
        </p>
        {failed ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {t('backup.key.generateFailed')}
          </p>
        ) : keys ? (
          <>
            <pre
              aria-label={t('backup.key.label')}
              className="max-h-36 overflow-auto rounded-lg border border-border bg-surface-inset p-3 font-mono text-xs text-fg"
              tabIndex={0}
            >
              {keys.privateKey}
            </pre>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="subtle"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(keys.privateKey)
                    toast.success(t('backup.key.copied'))
                  } catch {
                    toast.error(t('backup.key.copyFailed'))
                  }
                }}
              >
                <Copy aria-hidden="true" className="size-4" />
                {t('backup.key.copy')}
              </Button>
              <Button
                type="button"
                variant="subtle"
                onClick={() => {
                  const url = URL.createObjectURL(
                    new Blob([keys.privateKey], { type: 'text/plain' }),
                  )
                  const anchor = document.createElement('a')
                  anchor.href = url
                  anchor.download = 'mx-backup-recovery-key.pem'
                  anchor.click()
                  URL.revokeObjectURL(url)
                }}
              >
                <Download aria-hidden="true" className="size-4" />
                {t('backup.key.download')}
              </Button>
            </div>
            <Checkbox
              checked={saved}
              onCheckedChange={setSaved}
              label={t('backup.key.saved')}
            />
          </>
        ) : (
          <p className="flex items-center gap-2 text-sm text-fg-muted">
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            {t('backup.key.generating')}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="subtle"
            onClick={() => modal.dismiss()}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            disabled={!keys || !saved}
            onClick={() => {
              if (keys) modal.close(keys.publicKey)
            }}
          >
            {t('backup.key.enable')}
          </Button>
        </div>
      </div>
    </div>
  )
}

function RestoreBackupKeyModal(props: {
  onRestore: (key: string) => Promise<void>
}) {
  const { t } = useI18n()
  const modal = useModal<void>()
  const [key, setKey] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div>
      <ModalHeader title={t('backup.key.restoreTitle')} showClose={false} />
      <form
        className="space-y-4 px-5 py-4"
        onSubmit={async (event) => {
          event.preventDefault()
          if (!key.trim() || pending) return
          setPending(true)
          setError('')
          try {
            await props.onRestore(key.trim())
            modal.close()
          } catch (error) {
            setError(
              error instanceof Error
                ? error.message
                : t('backup.key.restoreFailed'),
            )
          } finally {
            setPending(false)
          }
        }}
      >
        <p className="text-sm text-fg-muted">
          {t('backup.key.restoreDescription')}
        </p>
        <TextArea
          disabled={pending}
          label={t('backup.key.label')}
          value={key}
          onChange={setKey}
          maxLength={16_384}
          spellCheck={false}
          required
          controlClassName="font-mono text-xs"
        />
        <input
          type="file"
          accept=".pem,.key,.txt"
          className="hidden"
          ref={fileRef}
          onChange={async (event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) return
            try {
              if (file.size > 16_384)
                throw new Error(t('backup.key.invalidFile'))
              setKey(await file.text())
              setError('')
            } catch {
              setError(t('backup.key.invalidFile'))
            }
          }}
        />
        <Button
          type="button"
          variant="subtle"
          disabled={pending}
          onClick={() => fileRef.current?.click()}
        >
          <Upload aria-hidden="true" className="size-4" />
          {t('backup.key.import')}
        </Button>
        {error ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="subtle"
            disabled={pending}
            onClick={() => modal.dismiss()}
          >
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={pending || !key.trim()}>
            {pending ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : null}
            {t('backup.key.restore')}
          </Button>
        </div>
      </form>
    </div>
  )
}

const options = {
  modalProps: { popupStyle: { width: 'min(92vw, 36rem)' } },
  dismissable: false,
} as const

export function presentEnableBackupEncryption() {
  return present<{}, string>(SaveBackupKeyModal, {}, options)
}

export function presentRestoreBackupKey(
  onRestore: (key: string) => Promise<void>,
) {
  return present(RestoreBackupKeyModal, { onRestore }, options)
}
