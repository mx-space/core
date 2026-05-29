import { useEffect, useMemo } from 'react'

import { CodeEditor } from '~/ui/primitives/code-editor'

import {
  EJS_HTML_LANGUAGE_ID,
  ensureEjsHtmlRegistered,
  setPropsKeysProvider,
} from '../lib/ejs-monaco'

interface TemplateCodeEditorProps {
  dirty: boolean
  onChange: (value: string) => void
  onSave: () => void
  propsKeys: string[]
  saving: boolean
  value: string
}

export function TemplateCodeEditor(props: TemplateCodeEditorProps) {
  const keysSignature = useMemo(
    () => props.propsKeys.join('|'),
    [props.propsKeys],
  )

  useEffect(() => {
    ensureEjsHtmlRegistered()
  }, [])

  useEffect(() => {
    setPropsKeysProvider(() => props.propsKeys)
  }, [keysSignature])

  return (
    <CodeEditor
      dirty={props.dirty}
      language={EJS_HTML_LANGUAGE_ID}
      onChange={props.onChange}
      onSave={props.onSave}
      saving={props.saving}
      title="ejs · html"
      value={props.value}
    />
  )
}
