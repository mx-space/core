import { useMutation } from '@tanstack/react-query'
import { Loader2, Upload, X } from 'lucide-react'
import type { FormEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { uploadFile } from '~/api/files'
import { ModalHeader } from '~/ui/feedback/modal'
import { present, useModal } from '~/ui/feedback/modal-imperative'
import { Button } from '~/ui/primitives/button'
import { TextInput } from '~/ui/primitives/text-field'

import type { GpxPoint } from './gps-compress'
import { buildTrackFile, isGpxFile, readGpxFile } from './gps-compress'
import { MapBlockReadonly } from './MapBlockReadonly'
import type { MapNodePayload } from './MapNode'

interface InsertMapDialogProps {
  initial?: MapNodePayload
  onSubmit: (payload: MapNodePayload) => void
}

type RawPick =
  | {
      file: File
      points: GpxPoint[]
      tzOffsetMinutes: number | null
      type: 'gpx'
    }
  | { file: File; type: 'json' }

const DEFAULT_CLUSTER_RADIUS_M = 80
const DEFAULT_DWELL_MINUTES = 10

function InsertMapDialog(props: InsertMapDialogProps) {
  const modal = useModal<void>()
  const [title, setTitle] = useState(props.initial?.title ?? '')
  const [trackUrl, setTrackUrl] = useState(props.initial?.track?.url ?? '')
  const [raw, setRaw] = useState<RawPick | null>(null)
  const [clusterRadiusM, setClusterRadiusM] = useState(DEFAULT_CLUSTER_RADIUS_M)
  const [dwellMinutes, setDwellMinutes] = useState(DEFAULT_DWELL_MINUTES)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const prepareMutation = useMutation({
    mutationFn: async (file: File): Promise<RawPick> => {
      if (!isGpxFile(file)) {
        const text = await file.text()
        if (!/<gpx\b/i.test(text)) return { file, type: 'json' }
        const { points, tzOffsetMinutes } = await readGpxFile(
          new File([text], file.name, { type: 'application/gpx+xml' }),
        )
        return { file, points, tzOffsetMinutes, type: 'gpx' }
      }
      const { points, tzOffsetMinutes } = await readGpxFile(file)
      return { file, points, tzOffsetMinutes, type: 'gpx' }
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(`Failed to read file: ${message}`)
    },
    onSuccess: (next) => {
      setTrackUrl('')
      setRaw(next)
    },
  })

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadFile(file, 'file'),
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(`Failed to upload track: ${message}`)
    },
  })

  const prepared = useMemo(() => {
    if (!raw) return null
    if (raw.type === 'json') {
      return { file: raw.file, stopCount: null as number | null }
    }
    const baseFileName = raw.file.name.replace(/\.gpx$/i, '')
    const { file, trackData } = buildTrackFile(baseFileName, raw.points, {
      detectStopsOptions: {
        clusterRadiusM,
        minMergedSec: dwellMinutes * 60,
      },
      sampleTarget: null,
      timezoneOffsetMinutes: raw.tzOffsetMinutes,
    })
    return {
      file,
      stopCount: trackData.stops?.length ?? 0,
    }
  }, [raw, clusterRadiusM, dwellMinutes])

  useEffect(() => {
    if (!prepared) {
      setBlobUrl(null)
      return
    }
    const url = URL.createObjectURL(prepared.file)
    setBlobUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [prepared])

  const previewUrl = blobUrl || trackUrl
  const previewSlot = useMemo(
    () => ({
      track: previewUrl ? { url: previewUrl } : undefined,
      title: title || 'Map preview',
    }),
    [title, previewUrl],
  )

  const onTrackUrlChange = (value: string) => {
    setTrackUrl(value)
    if (raw) setRaw(null)
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!canInsert) return
    let finalUrl = trackUrl
    if (prepared) {
      const result = await uploadMutation.mutateAsync(prepared.file)
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
  const canInsert = (!!raw || !!trackUrl) && !busy

  return (
    <form className="flex w-full flex-col" onSubmit={onSubmit}>
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
                disabled={!!raw}
                onChange={onTrackUrlChange}
                placeholder={raw ? raw.file.name : 'https://…/track.json'}
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
            {raw ? (
              <Button
                aria-label="Clear selected file"
                className="h-9 w-9"
                iconOnly
                onClick={() => setRaw(null)}
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
            {raw
              ? `Selected: ${raw.file.name} · uploads on insert`
              : 'Select a .gpx file (full track preserved) or paste a pre-built track JSON URL.'}
          </p>
        </div>
        {raw?.type === 'gpx' ? (
          <div className="grid gap-2 rounded-sm border border-border bg-surface-inset p-3">
            <div className="text-xs font-medium text-fg">Stop detection</div>
            <div className="grid grid-cols-2 gap-3">
              <TextInput
                inputMode="numeric"
                label="Cluster radius (m)"
                min={1}
                onChange={(value) => {
                  const next = Number.parseInt(value, 10)
                  if (Number.isFinite(next) && next > 0) setClusterRadiusM(next)
                }}
                type="number"
                value={String(clusterRadiusM)}
              />
              <TextInput
                inputMode="numeric"
                label="Min dwell (minutes)"
                min={1}
                onChange={(value) => {
                  const next = Number.parseInt(value, 10)
                  if (Number.isFinite(next) && next > 0) setDwellMinutes(next)
                }}
                type="number"
                value={String(dwellMinutes)}
              />
            </div>
            <p className="text-xs text-fg-muted">
              Group GPS samples within {clusterRadiusM} m and surface clusters
              dwelt in for at least {dwellMinutes} minute
              {dwellMinutes === 1 ? '' : 's'} as stops. Detected:{' '}
              {prepared?.stopCount ?? 0}.
            </p>
          </div>
        ) : null}
        {previewUrl ? (
          <MapBlockReadonly {...previewSlot} className="my-0" />
        ) : null}
      </div>
      <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
        <Button onClick={() => modal.dismiss()} type="button" variant="subtle">
          Cancel
        </Button>
        <Button disabled={!canInsert} type="submit">
          {uploadMutation.isPending ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : null}
          {uploadMutation.isPending ? 'Uploading…' : 'Insert'}
        </Button>
      </div>
    </form>
  )
}

export function presentInsertMapDialog(props: InsertMapDialogProps) {
  return present<InsertMapDialogProps, void>(InsertMapDialog, props, {
    modalProps: { popupStyle: { width: 'min(92vw, 40rem)' } },
  })
}
