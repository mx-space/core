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
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}
