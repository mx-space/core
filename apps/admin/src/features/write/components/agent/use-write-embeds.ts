import type { LexicalEditor } from 'lexical'
import { type RefObject, useEffect, useMemo, useRef } from 'react'
import { toast } from 'sonner'

import { API_URL } from '~/constants/env'
import { $findBlockByBlockId } from '~/vendor/rich-editor/utils/apply-agent-review-batch'
import { allowDynamicVersionHosts } from '~/vendor/rich-editor/utils/dynamic-catalog'
import { loadOwnStorageHosts } from '~/vendor/rich-editor/utils/own-storage-hosts'

import { createDynamicCatalogSync } from './dynamic-catalog-sync'
import { createWriteEmbedMount } from './write-embed-mount'

export function useWriteEmbeds({
  draftId,
  lexicalEditorRef,
}: {
  draftId?: string
  lexicalEditorRef: RefObject<LexicalEditor | null>
}) {
  const draftIdRef = useRef(draftId)
  draftIdRef.current = draftId
  const ownHostsRef = useRef<readonly string[]>([
    new URL(API_URL, window.location.origin).host,
  ])
  useEffect(() => {
    let cancelled = false
    void loadOwnStorageHosts().then((hosts) => {
      if (cancelled) return
      ownHostsRef.current = hosts
      allowDynamicVersionHosts(hosts)
    })
    return () => {
      cancelled = true
    }
  }, [])
  const { embeds, catalogSync } = useMemo(() => {
    const sync = createDynamicCatalogSync({
      pendingDynamic: (url) => mount.pendingDynamic(url),
    })
    const mount = createWriteEmbedMount({
      apiUrl: API_URL,
      dynamicMeta: { read: sync.read, save: sync.save },
      getDraftId: () => draftIdRef.current || undefined,
      getOwnHosts: () => ownHostsRef.current,
      readBlock: (blockId) => {
        const editor = lexicalEditorRef.current
        if (!editor) return null
        return editor.getEditorState().read(() => {
          const node = $findBlockByBlockId(blockId)
          return node
            ? (node.exportJSON() as unknown as Record<string, unknown>)
            : null
        })
      },
    })
    return { embeds: mount, catalogSync: sync }
  }, [])
  const registerDynamics = (nodes: unknown) => {
    void catalogSync.register(nodes).catch((error: unknown) => {
      toast.error(error instanceof Error ? error.message : String(error))
    })
  }
  return { embeds, registerDynamics }
}
