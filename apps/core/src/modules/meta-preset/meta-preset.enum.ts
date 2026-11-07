export enum MetaFieldType {
  Text = 'text',
  Textarea = 'textarea',
  Number = 'number',
  Url = 'url',
  Select = 'select',
  MultiSelect = 'multi-select',
  Checkbox = 'checkbox',
  Tags = 'tags',
  Boolean = 'boolean',
  Object = 'object',
  /** BCP 47 language tag: pick from `options` suggestions or type any valid tag. */
  Language = 'language',
}

export enum MetaPresetScope {
  Post = 'post',
  Note = 'note',
  Both = 'both',
}
