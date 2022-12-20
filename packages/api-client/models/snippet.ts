import { BaseModel } from './base'

export enum SnippetType {
  JSON = 'json',
  Function = 'function',
  Text = 'text',
  YAML = 'yaml',
}
export interface SnippetModel<T = unknown> extends BaseModel {
  type: SnippetType
  private: boolean
  raw: string
  name: string
  reference: string
  comment?: string
  metatype?: string
  schema?: string
  data: T
}
