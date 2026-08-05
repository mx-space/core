export interface FileUsageMatch {
  fileUrl: string
  sourceField: string
  sourceId: string
  sourceType: string
}

export interface FileUsageInput extends Omit<FileUsageMatch, 'fileUrl'> {
  fileReferenceId: string
}

export interface LocalFileCandidate {
  fileName: string
  fileUrl: string
}

export interface FileReferenceReconciliationResult {
  applied: boolean
  discoveredLocalFiles: number
  isolatedFiles: number
  missingReferences: number
  referencedFiles: number
  scannedFiles: number
  statusToActive: number
  statusToPending: number
  usageChanges: number
  usages: number
}
