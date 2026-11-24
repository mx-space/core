type CheckVisibilityFn = (opts?: {
  checkOpacity?: boolean
  checkVisibilityCSS?: boolean
  contentVisibilityAuto?: boolean
}) => boolean

export function isItemVisible(el: HTMLElement): boolean {
  const cv = (el as unknown as { checkVisibility?: CheckVisibilityFn })
    .checkVisibility
  if (typeof cv === 'function') {
    return cv.call(el, { checkOpacity: true, checkVisibilityCSS: true })
  }
  return el.offsetParent !== null
}

export function isTextInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  if (target.closest('input, textarea, select, .monaco-editor, .cm-editor')) {
    return true
  }
  const editable = target.closest('[contenteditable]')
  return (
    (target instanceof HTMLElement && target.isContentEditable) ||
    editable?.matches(
      '[contenteditable=""], [contenteditable="true" i], [contenteditable="plaintext-only" i]',
    ) === true
  )
}
