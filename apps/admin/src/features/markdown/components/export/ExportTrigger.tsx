import { Download, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { ExportConfig } from '../../types/markdown'

import { exportMarkdown } from '~/api/markdown'
import { useI18n } from '~/i18n'
import { Button } from '~/ui/primitives/button'

import { saveBlob } from '../../utils/files'
import { getErrorMessage } from '../../utils/format'

interface ExportTriggerProps {
  config: ExportConfig
}

export function ExportTrigger(props: ExportTriggerProps) {
  const { t } = useI18n()
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const blob = await exportMarkdown({
        show_title: props.config.titleBigTitle,
        slug: props.config.filenameSlug,
        with_meta_json: props.config.withMetaJson,
        yaml: props.config.includeYAMLHeader,
      })
      saveBlob(blob, 'markdown.zip')
      toast.success(t('markdown.export.success'))
    } catch (error) {
      toast.error(getErrorMessage(error, t('markdown.export.failed')))
    } finally {
      setExporting(false)
    }
  }

  return (
    <Button
      disabled={exporting}
      onClick={() => void handleExport()}
      type="button"
    >
      {exporting ? (
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
      ) : (
        <Download aria-hidden="true" className="size-4" />
      )}
      {t('markdown.export.submit')}
    </Button>
  )
}
