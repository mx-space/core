import zeroperlWasmUrl from '@6over3/zeroperl-ts/zeroperl.wasm?url'
import { gps } from 'exifr'
import { ExternalLink, MapPin, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

import { translate } from '~/i18n/translate'
import { ModalFooter, ModalHeader } from '~/ui/feedback/modal'
import { present, useModal } from '~/ui/feedback/modal-imperative'
import { Button } from '~/ui/primitives/button'

type GpsPrivacyDecision = 'keep' | 'strip'

interface ImageGpsLocation {
  latitude: number
  longitude: number
}

interface ImageGpsPrivacyDialogProps {
  fileName: string
  location: ImageGpsLocation
}

function ImageGpsPrivacyDialog(props: ImageGpsPrivacyDialogProps) {
  const modal = useModal<GpsPrivacyDecision>()
  const coordinates = formatGpsCoordinates(props.location)
  const mapUrl = getMapUrl(props.location)

  return (
    <div className="flex w-full flex-col">
      <ModalHeader
        icon={MapPin}
        title={translate('imageUploadPrivacy.dialog.title')}
      />

      <div className="grid gap-4 px-5 py-4">
        <div className="grid gap-1.5">
          <p className="text-sm leading-6 text-fg">
            {translate('imageUploadPrivacy.dialog.description')}
          </p>
          <p className="break-all rounded-md bg-surface-inset px-3 py-2 font-mono text-xs text-fg-muted">
            {props.fileName}
          </p>
        </div>

        <div className="grid gap-2 rounded-md border border-border bg-surface-card px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-medium text-fg">
                {translate('imageUploadPrivacy.dialog.coordinatesTitle')}
              </div>
              <div className="mt-1 font-mono text-xs tabular-nums text-fg-muted">
                {coordinates}
              </div>
            </div>
            <a
              className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-sm border border-border bg-surface-card px-2.5 text-xs font-medium text-fg shadow-xs outline-hidden transition-colors hover:bg-surface-inset focus-visible:ring-[3px] focus-visible:ring-accent/15"
              href={mapUrl}
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink aria-hidden="true" className="size-3.5" />
              {translate('imageUploadPrivacy.dialog.openMap')}
            </a>
          </div>
        </div>

        <div className="rounded-md bg-surface-inset px-3 py-2.5 text-xs leading-5 text-fg-muted">
          <div className="mb-1 flex items-center gap-1.5 font-medium text-fg">
            <ShieldCheck aria-hidden="true" className="size-3.5" />
            {translate('imageUploadPrivacy.dialog.safetyTitle')}
          </div>
          {translate('imageUploadPrivacy.dialog.safetyDescription')}
        </div>
      </div>

      <ModalFooter>
        <Button onClick={() => modal.dismiss()} type="button" variant="subtle">
          {translate('common.cancel')}
        </Button>
        <Button
          onClick={() => modal.close('keep')}
          type="button"
          variant="secondary"
        >
          {translate('imageUploadPrivacy.dialog.keepGps')}
        </Button>
        <Button onClick={() => modal.close('strip')} type="button">
          {translate('imageUploadPrivacy.dialog.stripGps')}
        </Button>
      </ModalFooter>
    </div>
  )
}

async function presentImageGpsPrivacyDialog(
  file: File,
  location: ImageGpsLocation,
): Promise<GpsPrivacyDecision | undefined> {
  return await present<ImageGpsPrivacyDialogProps, GpsPrivacyDecision>(
    ImageGpsPrivacyDialog,
    { fileName: file.name, location },
    {
      modalProps: { popupStyle: { width: 'min(92vw, 30rem)' } },
    },
  )
}

async function readGpsLocation(file: File): Promise<ImageGpsLocation | null> {
  try {
    const location = await gps(file)
    if (
      Number.isFinite(location?.latitude) &&
      Number.isFinite(location?.longitude)
    ) {
      return {
        latitude: location.latitude,
        longitude: location.longitude,
      }
    }
  } catch {
    // Invalid or partially corrupt metadata should not block normal uploads.
  }
  return null
}

async function stripGpsMetadata(file: File): Promise<File> {
  const { writeMetadata } = await import('@uswriting/exiftool')
  const result = await writeMetadata(
    file,
    {
      'GPS:all': '',
      'XMP:Geotag': '',
    },
    {
      fetch: () => fetch(zeroperlWasmUrl),
    },
  )

  if (!result.success) {
    throw new Error(result.error)
  }

  return new File([result.data], file.name, {
    lastModified: file.lastModified,
    type: file.type,
  })
}

export async function prepareImageFileForUpload(
  file: File,
): Promise<File | null> {
  if (!file.type.startsWith('image/')) return file

  const location = await readGpsLocation(file)
  if (!location) return file

  const decision = await presentImageGpsPrivacyDialog(file, location)
  if (!decision) return null
  if (decision === 'keep') return file

  try {
    return await stripGpsMetadata(file)
  } catch (error) {
    console.warn('Failed to strip GPS metadata before upload', error)
    toast.error(translate('imageUploadPrivacy.toast.stripFailed'))
    return null
  }
}

function formatGpsCoordinates(location: ImageGpsLocation) {
  return `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`
}

function getMapUrl(location: ImageGpsLocation) {
  const lat = location.latitude.toFixed(6)
  const lon = location.longitude.toFixed(6)
  const params = new URLSearchParams({
    mlat: lat,
    mlon: lon,
  })
  return `https://www.openstreetmap.org/?${params.toString()}#map=16/${lat}/${lon}`
}
