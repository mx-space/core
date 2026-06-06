import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { DRAG_DROP_PASTE } from '@lexical/rich-text'
import {
  $getSelection,
  $insertNodes,
  COMMAND_PRIORITY_EDITOR,
  COMMAND_PRIORITY_HIGH,
  PASTE_COMMAND,
} from 'lexical'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

import { buildTrackFile, isGpxFile, readGpxFile } from './gps-compress'
import { presentInsertMapDialog } from './InsertMapDialog'
import {
  registerMapDialogOpener,
  unregisterMapDialogOpener,
} from './map-plugin-bridge'
import {
  $createMapNode,
  INSERT_MAP_COMMAND,
  type MapNodePayload,
} from './MapNode'

export type TrackUploadFn = (file: File) => Promise<{ url: string }>

export interface MapPluginProps {
  trackUpload?: TrackUploadFn
}

export function MapPlugin({ trackUpload }: MapPluginProps = {}): null {
  const [editor] = useLexicalComposerContext()
  const uploadRef = useRef<TrackUploadFn | undefined>(trackUpload)
  uploadRef.current = trackUpload

  useEffect(() => {
    registerMapDialogOpener(editor, (payload) => {
      void presentInsertMapDialog({
        initial: payload.initial,
        onSubmit: (next) => payload.onSubmit(next),
      })
    })
    return () => unregisterMapDialogOpener(editor)
  }, [editor])

  useEffect(() => {
    return editor.registerCommand<MapNodePayload>(
      INSERT_MAP_COMMAND,
      (payload) => {
        editor.update(() => {
          const node = $createMapNode(payload)
          const selection = $getSelection()
          if (selection) $insertNodes([node])
        })
        return true
      },
      COMMAND_PRIORITY_EDITOR,
    )
  }, [editor])

  useEffect(() => {
    const handleFiles = (files: File[]): boolean => {
      const gpxFiles = files.filter(isGpxFile)
      if (gpxFiles.length === 0) return false
      const upload = uploadRef.current
      if (!upload) {
        console.warn(
          '[MapPlugin] GPX dropped but no trackUpload handler is configured',
        )
        return false
      }
      for (const file of gpxFiles) void ingestGpx(file, upload, editor)
      return true
    }

    const unregisterDrop = editor.registerCommand(
      DRAG_DROP_PASTE,
      (files: File[]) => handleFiles(files),
      COMMAND_PRIORITY_HIGH,
    )

    const unregisterPaste = editor.registerCommand(
      PASTE_COMMAND,
      (event) => {
        const clipboardData =
          'clipboardData' in event
            ? (event as ClipboardEvent).clipboardData
            : null
        if (!clipboardData) return false
        const files = [...clipboardData.files]
        if (!files.some(isGpxFile)) return false
        return handleFiles(files)
      },
      COMMAND_PRIORITY_HIGH,
    )

    return () => {
      unregisterDrop()
      unregisterPaste()
    }
  }, [editor])

  return null
}

async function ingestGpx(
  file: File,
  upload: TrackUploadFn,
  editor: ReturnType<typeof useLexicalComposerContext>[0],
) {
  const toastId = toast.loading(`Processing ${file.name}…`)
  try {
    const { points, tzOffsetMinutes } = await readGpxFile(file)
    const baseFileName = file.name.replace(/\.gpx$/i, '')
    const { file: trackFile } = buildTrackFile(baseFileName, points, {
      sampleTarget: null,
      timezoneOffsetMinutes: tzOffsetMinutes,
    })
    toast.loading(`Uploading ${trackFile.name}…`, { id: toastId })
    const { url } = await upload(trackFile)
    editor.dispatchCommand(INSERT_MAP_COMMAND, {
      title: baseFileName || 'Map',
      track: { url },
    })
    toast.success(`Inserted map: ${baseFileName}`, { id: toastId })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    toast.error(`Failed to insert GPX: ${message}`, { id: toastId })
    console.error('[MapPlugin] Failed to ingest GPX', error)
  }
}
