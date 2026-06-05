import { useMutation } from '@tanstack/react-query'
import { Loader2, Upload, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { uploadFile } from '~/api/files'
import { ModalHeader } from '~/ui/feedback/modal'
import { present, useModal } from '~/ui/feedback/modal-imperative'
import { Button } from '~/ui/primitives/button'
import { TextInput } from '~/ui/primitives/text-field'

import {
  buildTrackJson,
  extractTimezoneOffsetMinutes,
  parseGpx,
} from './gps-compress'
import { MapBlockReadonly } from './MapBlockReadonly'
import type { MapNodePayload } from './MapNode'

interface InsertMapDialogProps {
  initial?: MapNodePayload
  onSubmit: (payload: MapNodePayload) => void
}

interface PendingUpload {
  blobUrl: string
  file: File
}

function InsertMapDialog(props: InsertMapDialogProps) {
  const modal = useModal<void>()
  const [title, setTitle] = useState(props.initial?.title ?? '')
  const [trackUrl, setTrackUrl] = useState(props.initial?.track?.url ?? '')
  const [pending, setPending] = useState<PendingUpload | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      if (pending) URL.revokeObjectURL(pending.blobUrl)
    }
  }, [pending])

  const prepareMutation = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text()
      if (!isGpx(text, file.name)) {
        return { blob: file, fileName: file.name }
      }
      const points = parseGpx(text)
      if (points.length === 0) {
        throw new Error('No valid GPS points found in file')
      }
      const tzOffsetMinutes = extractTimezoneOffsetMinutes(text)
      const trackData = buildTrackJson(
        points,
        file.name.replace(/\.gpx$/i, ''),
        {
          sampleTarget: null,
          timezoneOffsetMinutes: tzOffsetMinutes,
        },
      )
      const jsonBlob = new Blob([JSON.stringify(trackData)], {
        type: 'application/json',
      })
      return {
        blob: jsonBlob,
        fileName: `${file.name.replace(/\.gpx$/i, '')}.json`,
      }
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(`Failed to read file: ${message}`)
    },
    onSuccess: ({ blob, fileName }) => {
      const preparedFile = new File([blob], fileName, { type: blob.type })
      const blobUrl = URL.createObjectURL(blob)
      setPending((prev) => {
        if (prev) URL.revokeObjectURL(prev.blobUrl)
        return { blobUrl, file: preparedFile }
      })
      setTrackUrl('')
    },
  })

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadFile(file, 'file'),
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(`Failed to upload track: ${message}`)
    },
  })

  const previewUrl = pending?.blobUrl || trackUrl
  const previewSlot = useMemo(
    () => ({
      track: previewUrl ? { url: previewUrl } : undefined,
      title: title || 'Map preview',
    }),
    [title, previewUrl],
  )

  const onTrackUrlChange = (value: string) => {
    setTrackUrl(value)
    if (pending) {
      URL.revokeObjectURL(pending.blobUrl)
      setPending(null)
    }
  }

  const clearPending = () => {
    if (pending) {
      URL.revokeObjectURL(pending.blobUrl)
      setPending(null)
    }
  }

  const onSubmit = async () => {
    let finalUrl = trackUrl
    if (pending) {
      const result = await uploadMutation.mutateAsync(pending.file)
      finalUrl = result.url
    }
    if (!finalUrl) {
      toast.error('Track URL is required')
      return
    }
    props.onSubmit({
      title: title || 'Map',
      track: { url: finalUrl },
    })
    modal.close()
  }

  const busy = prepareMutation.isPending || uploadMutation.isPending
  const canInsert = (!!pending || !!trackUrl) && !busy

  return (
    <div className="flex w-full flex-col">
      <ModalHeader title="Insert map" />
      <div className="grid gap-4 px-5 py-4">
        <TextInput
          autoFocus
          label="Title"
          onChange={setTitle}
          placeholder="e.g. Tokyo · Day 1"
          value={title}
        />
        <div className="grid gap-1.5 text-sm">
          <label className="text-xs font-medium text-fg">Track JSON URL</label>
          <div className="flex items-stretch gap-2">
            <div className="flex-1">
              <TextInput
                disabled={!!pending}
                onChange={onTrackUrlChange}
                placeholder={
                  pending ? pending.file.name : 'https://…/track.json'
                }
                value={trackUrl}
              />
            </div>
            <input
              accept=".gpx,.json,application/json,application/gpx+xml"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) prepareMutation.mutate(file)
              }}
              ref={fileInputRef}
              type="file"
            />
            {pending ? (
              <Button
                aria-label="Clear selected file"
                className="h-9 w-9"
                iconOnly
                onClick={clearPending}
                title="Clear selected file"
                type="button"
                variant="subtle"
              >
                <X aria-hidden="true" className="size-4" />
              </Button>
            ) : (
              <Button
                aria-label="Select track file"
                className="h-9 w-9"
                disabled={prepareMutation.isPending}
                iconOnly
                onClick={() => fileInputRef.current?.click()}
                title="Select .gpx or .json"
                type="button"
                variant="subtle"
              >
                {prepareMutation.isPending ? (
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  <Upload aria-hidden="true" className="size-4" />
                )}
              </Button>
            )}
          </div>
          <p className="text-xs text-fg-muted">
            {pending
              ? `Selected: ${pending.file.name} · uploads on insert`
              : 'Select a .gpx file (full track preserved) or paste a pre-built track JSON URL.'}
          </p>
        </div>
        {previewUrl ? (
          <div className="rounded-sm border border-border bg-surface-inset">
            <MapBlockReadonly {...previewSlot} className="my-0" />
          </div>
        ) : null}
      </div>
      <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
        <Button onClick={() => modal.dismiss()} type="button" variant="subtle">
          Cancel
        </Button>
        <Button disabled={!canInsert} onClick={onSubmit} type="button">
          {uploadMutation.isPending ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : null}
          {uploadMutation.isPending ? 'Uploading…' : 'Insert'}
        </Button>
      </div>
    </div>
  )
}

function isGpx(text: string, filename: string): boolean {
  if (/\.gpx$/i.test(filename)) return true
  return /<gpx\b/i.test(text)
}

export function presentInsertMapDialog(props: InsertMapDialogProps) {
  return present<InsertMapDialogProps, void>(InsertMapDialog, props, {
    modalProps: { popupStyle: { width: 'min(92vw, 40rem)' } },
  })
}
