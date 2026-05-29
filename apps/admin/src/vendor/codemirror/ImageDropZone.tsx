import { Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { uploadImageFile, useEditorView } from './editor-store'

const findScrollableParent = (el: HTMLElement | null): HTMLElement | null => {
  while (el) {
    const style = getComputedStyle(el)
    const overflowY = style.overflowY
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      el.scrollHeight > el.clientHeight
    ) {
      return el
    }
    el = el.parentElement
  }
  return null
}

export function ImageDropZone() {
  const view = useEditorView()
  const [isDragging, setIsDragging] = useState(false)
  const [teleportTarget, setTeleportTarget] = useState<HTMLElement | null>(null)
  const dragCounterRef = useRef(0)

  useEffect(() => {
    if (!view) {
      setTeleportTarget(null)
      return
    }

    const hasImageFile = (dataTransfer: DataTransfer | null) => {
      if (!dataTransfer?.items) return false
      for (const item of dataTransfer.items) {
        if (item.type.startsWith('image/')) return true
      }
      return false
    }

    const handleDrop = (event: DragEvent) => {
      dragCounterRef.current = 0
      setIsDragging(false)

      const files = event.dataTransfer?.files
      if (!files || files.length === 0) return

      const imageFiles = Array.from(files).filter((file) =>
        file.type.startsWith('image/'),
      )

      if (imageFiles.length > 0) {
        event.preventDefault()
        event.stopPropagation()
        imageFiles.forEach((file) => uploadImageFile(file))
      }
    }

    const handleDragOver = (event: DragEvent) => {
      if (hasImageFile(event.dataTransfer)) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    const handleDragEnter = (event: DragEvent) => {
      if (hasImageFile(event.dataTransfer)) {
        event.preventDefault()
        dragCounterRef.current++
        setIsDragging(true)
      }
    }

    const handleDragLeave = () => {
      dragCounterRef.current--
      if (dragCounterRef.current === 0) setIsDragging(false)
    }

    view.dom.addEventListener('drop', handleDrop)
    view.dom.addEventListener('dragover', handleDragOver)
    view.dom.addEventListener('dragenter', handleDragEnter)
    view.dom.addEventListener('dragleave', handleDragLeave)

    const scrollContainer = findScrollableParent(view.dom)
    setTeleportTarget(scrollContainer)

    return () => {
      view.dom.removeEventListener('drop', handleDrop)
      view.dom.removeEventListener('dragover', handleDragOver)
      view.dom.removeEventListener('dragenter', handleDragEnter)
      view.dom.removeEventListener('dragleave', handleDragLeave)
    }
  }, [view])

  if (!isDragging || !teleportTarget) return null

  const overlay = (
    <div className="pointer-events-none absolute inset-0 z-[100] flex items-center justify-center bg-white/60 backdrop-blur-md dark:bg-neutral-950/70">
      <div className="pointer-events-none flex flex-col items-center gap-6 rounded-2xl border border-neutral-200 bg-white px-16 py-12 shadow-2xl duration-150 dark:border-neutral-700 dark:bg-neutral-800">
        <Upload
          width={48}
          height={48}
          strokeWidth={1.5}
          className="text-neutral-400 dark:text-neutral-500"
        />
        <span className="text-lg font-medium text-neutral-600 dark:text-neutral-300">
          松开以上传图片
        </span>
      </div>
    </div>
  )

  return createPortal(overlay, teleportTarget)
}
