type SceneElement = { id?: string; type?: string; text?: string }

export type RestoreElements = (
  elements: SceneElement[],
  localElements: null,
  opts: { refreshDimensions: boolean },
) => unknown[]

function textsById(scene: { elements?: SceneElement[] } | null) {
  const texts = new Map<string, string>()
  for (const element of scene?.elements ?? []) {
    if (element.type === 'text' && element.id)
      texts.set(element.id, element.text ?? '')
  }
  return texts
}

function parse(text: string | null) {
  if (!text) return null
  try {
    return JSON.parse(text) as { elements?: SceneElement[] }
  } catch {
    return null
  }
}

export async function remeasureScene(
  next: string,
  previous: string | null,
  restore?: RestoreElements,
): Promise<string> {
  const scene = parse(next)
  if (!scene || !Array.isArray(scene.elements)) return next
  const before = textsById(parse(previous))
  const changed = [...textsById(scene)].some(
    ([id, text]) => before.get(id) !== text,
  )
  if (!changed) return next
  const restoreElements =
    restore ??
    ((await import('@excalidraw/excalidraw'))
      .restoreElements as unknown as RestoreElements)
  const elements = restoreElements(scene.elements, null, {
    refreshDimensions: true,
  })
  return JSON.stringify({ ...scene, elements }, null, 2)
}
