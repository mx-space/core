import type { GeneralSettingDto } from '../editor-config'

import { GeneralSettingSchema } from '../editor-config'

export interface EditorSettingState {
  general: GeneralSettingDto
}

export const initialEditorSettingState: EditorSettingState = {
  general: GeneralSettingSchema.parse({}),
}
