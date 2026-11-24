import { defaultKeybindingsHandlerIgnore, tinykeys } from 'tinykeys'
import type { KeybindingsMap } from 'tinykeys'

import { isTextInputTarget } from './dom-utils'

export function bindPageShortcuts(bindings: KeybindingsMap) {
  return tinykeys(window, bindings, {
    ignore: (event) =>
      event.defaultPrevented ||
      isTextInputTarget(event.target) ||
      defaultKeybindingsHandlerIgnore(event),
  })
}
