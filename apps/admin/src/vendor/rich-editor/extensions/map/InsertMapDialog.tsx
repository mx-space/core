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

import { buildLegsTrackJson, trackDataToFile } from './gps-compress'
import { MapBlockReadonly } from './MapBlockReadonly'
import { MapLegList } from './MapLegList'
import type { MapNodePayload } from './MapNode'
import type { GpxLeg, RawPick } from './parse-track-file'
import { parseTrackFile } from './parse-track-file'

interface InsertMapDialogProps {
  initial?: MapNodePayload
  onSubmit: (payload: MapNodePayload) => void
}

const DEFAULT_CLUSTER_RADIUS_M = 80
const DEFAULT_DWELL_MINUTES = 10

function InsertMapDialog(props: InsertMapDialogProps) {
  const modal = useModal<void>()
  const [title, setTitle] = useState(props.initial?.title ?? '')
  const [trackUrl, setTrackUrl] = useState(props.initial?.track?.url ?? '')
  const [raw, setRaw] = useState<RawPick | null>(null)
  const [legTitles, setLegTitles] = useState<Record<string, string>>({})
  const [clusterRadiusM, setClusterRadiusM] = useState(DEFAULT_CLUSTER_RADIUS_M)
  const [dwellMinutes, setDwellMinutes] = useState(DEFAULT_DWELL_MINUTES)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const prepareMutation = useMutation({
    mutationFn: (files: File[]) => Promise.all(files.map(parseTrackFile)),
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(`Failed to read file: ${message}`)
    },
    onSuccess: (parsed) => {
      const json = parsed.find((item) => item.type === 'json')
      if (json) {
        if (parsed.length > 1) {
          toast.error('A track JSON cannot be combined with other files')
          return
        }
        setTrackUrl('')
        setRaw(json)
        return
      }
      const added = parsed
        .flatMap((item) => (item.type === 'gpx' ? [item.leg] : []))
        .sort((a, b) => a.startTimeMs - b.startTimeMs)
      setTrackUrl('')
      setRaw((prev) => ({
        legs: [...(prev?.type === 'gpx' ? prev.legs : []), ...added],
        type: 'gpx',
      }))
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
      return { file: raw.file, trackData: null }
    }
    const baseFileName = raw.legs[0]!.baseName
    return trackDataToFile(
      baseFileName,
      buildLegsTrackJson(
        raw.legs.map((leg) => ({
          points: leg.points,
          timezoneOffsetMinutes: leg.tzOffsetMinutes,
          title: leg.baseName,
        })),
        baseFileName,
        {
          detectStopsOptions: {
            clusterRadiusM,
            minMergedSec: dwellMinutes * 60,
          },
          sampleTarget: null,
        },
      ),
    )
  }, [raw, clusterRadiusM, dwellMinutes])

  const gpxLegs = raw?.type === 'gpx' ? raw.legs : []
  const legTitle = (leg: GpxLeg) => legTitles[leg.id] ?? leg.baseName

  const updateLegs = (update: (legs: GpxLeg[]) => GpxLeg[]) => {
    setRaw((prev) => {
      if (prev?.type !== 'gpx') return prev
      const legs = update(prev.legs)
      return legs.length > 0 ? { legs, type: 'gpx' } : null
    })
  }

  const finalFile = () => {
    if (!prepared?.trackData?.legs) return prepared?.file ?? null
    const trackData = {
      ...prepared.trackData,
      legs: prepared.trackData.legs.map((leg, index) => ({
        ...leg,
        title: legTitle(gpxLegs[index]!) || leg.title,
      })),
      title: title || prepared.trackData.title,
    }
    return trackDataToFile(gpxLegs[0]!.baseName, trackData).file
  }

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
    const file = finalFile()
    if (file) {
      const result = await uploadMutation.mutateAsync(file)
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
                placeholder={
                  raw?.type === 'json'
                    ? raw.file.name
                    : raw
                      ? gpxLegs.map((leg) => leg.baseName).join(', ')
                      : 'https://…/track.json'
                }
                value={trackUrl}
              />
            </div>
            <input
              accept=".gpx,.json,application/json,application/gpx+xml"
              className="hidden"
              multiple
              onChange={(event) => {
                const files = [...(event.target.files ?? [])]
                event.target.value = ''
                if (files.length > 0) prepareMutation.mutate(files)
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
            {raw?.type === 'json'
              ? `Selected: ${raw.file.name} · uploads on insert`
              : raw
                ? `${gpxLegs.length} GPX file${gpxLegs.length === 1 ? '' : 's'} · uploads on insert`
                : 'Select one or more .gpx files (each becomes a leg) or paste a pre-built track JSON URL.'}
          </p>
        </div>
        {raw?.type === 'gpx' ? (
          <MapLegList
            adding={prepareMutation.isPending}
            legs={gpxLegs.map((leg) => ({ id: leg.id, title: legTitle(leg) }))}
            meta={prepared?.trackData?.legs}
            onAdd={() => fileInputRef.current?.click()}
            onMove={(index, delta) =>
              updateLegs((legs) => {
                const next = [...legs]
                const [leg] = next.splice(index, 1)
                next.splice(index + delta, 0, leg!)
                return next
              })
            }
            onRemove={(index) =>
              updateLegs((legs) => legs.filter((_, i) => i !== index))
            }
            onRename={(index, value) => {
              const id = gpxLegs[index]!.id
              setLegTitles((prev) => ({ ...prev, [id]: value }))
            }}
          />
        ) : null}
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
              {prepared?.trackData?.stops?.length ?? 0}.
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
