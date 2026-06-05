import { useMutation } from '@tanstack/react-query'
import { Loader2, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { uploadFile } from '~/api/files'
import { ModalHeader } from '~/ui/feedback/modal'
import { present, useModal } from '~/ui/feedback/modal-imperative'
import { Button } from '~/ui/primitives/button'
import { Switch } from '~/ui/primitives/switch'
import { TextInput } from '~/ui/primitives/text-field'

import {
  buildTrackJson,
  extractTimezoneOffsetMinutes,
  parseGpx,
} from './gps-compress'
import { MapBlockReadonly } from './MapBlockReadonly'
import type { MapNodePayload } from './MapNode'
import type { MapTrackData } from './types'

interface InsertMapDialogProps {
  initial?: MapNodePayload
  onSubmit: (payload: MapNodePayload) => void
}

const LOSSLESS_SAMPLE_TARGET = null
const LOSSY_SAMPLE_TARGET = 450

function InsertMapDialog(props: InsertMapDialogProps) {
  const modal = useModal<void>()
  const [title, setTitle] = useState(props.initial?.title ?? '')
  const [trackUrl, setTrackUrl] = useState(props.initial?.track?.url ?? '')
  const [previewTrack, setPreviewTrack] = useState<MapTrackData | null>(null)
  const [lossless, setLossless] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!trackUrl) {
      setPreviewTrack(null)
      return
    }
    let cancelled = false
    fetch(trackUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json() as Promise<MapTrackData>
      })
      .then((payload) => {
        if (!cancelled) setPreviewTrack(payload)
      })
      .catch(() => {
        if (!cancelled) setPreviewTrack(null)
      })
    return () => {
      cancelled = true
    }
  }, [trackUrl])

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text()
      if (!isGpx(text, file.name)) {
        return uploadFile(file, 'file')
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
          sampleTarget: lossless ? LOSSLESS_SAMPLE_TARGET : LOSSY_SAMPLE_TARGET,
          timezoneOffsetMinutes: tzOffsetMinutes,
        },
      )
      const jsonBlob = new Blob([JSON.stringify(trackData)], {
        type: 'application/json',
      })
      const jsonFile = new File(
        [jsonBlob],
        `${file.name.replace(/\.gpx$/i, '')}.json`,
        { type: 'application/json' },
      )
      return uploadFile(jsonFile, 'file')
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(`Failed to upload track: ${message}`)
    },
    onSuccess: (result) => {
      setTrackUrl(result.url)
      if (!title) setTitle(result.name.replace(/\.(gpx|json)$/i, ''))
      toast.success('Track uploaded')
    },
  })

  const previewSlot = useMemo(
    () => ({
      track: trackUrl ? { url: trackUrl } : undefined,
      title: title || 'Map preview',
    }),
    [title, trackUrl],
  )

  const onSubmit = () => {
    if (!trackUrl) {
      toast.error('Track URL is required')
      return
    }
    props.onSubmit({
      title: title || 'Map',
      track: { url: trackUrl },
    })
    modal.close()
  }

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
                onChange={setTrackUrl}
                placeholder="https://…/track.json"
                value={trackUrl}
              />
            </div>
            <input
              accept=".gpx,.json,application/json,application/gpx+xml"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) uploadMutation.mutate(file)
              }}
              ref={fileInputRef}
              type="file"
            />
            <Button
              aria-label="Upload track"
              disabled={uploadMutation.isPending}
              onClick={() => fileInputRef.current?.click()}
              title="Upload .gpx or .json"
              type="button"
              variant="subtle"
            >
              {uploadMutation.isPending ? (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <Upload aria-hidden="true" className="size-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-fg-muted">
            Upload a .gpx file to auto-compress, or a pre-built track JSON.
          </p>
        </div>
        <Switch
          checked={lossless}
          description="Keep all GPS points (larger file). Off uses ~450 points via RDP."
          label="Lossless"
          onCheckedChange={setLossless}
        />
        {trackUrl ? (
          <div className="rounded-sm border border-border bg-surface-inset">
            <MapBlockReadonly {...previewSlot} className="my-0" />
          </div>
        ) : null}
        {!previewTrack && trackUrl ? (
          <p className="text-xs text-fg-muted">Loading preview…</p>
        ) : null}
      </div>
      <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
        <Button onClick={() => modal.dismiss()} type="button" variant="subtle">
          Cancel
        </Button>
        <Button disabled={!trackUrl} onClick={onSubmit} type="button">
          Insert
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
