import { describe, expect, it, vi } from 'vitest'

import type { FileReferenceReconciliationResult } from '~/api/files'

import {
  hasReferenceReconcileChanges,
  runReferenceReconcileFlow,
} from './ReferenceReconcilePreview'

const result = (
  overrides: Partial<FileReferenceReconciliationResult> = {},
): FileReferenceReconciliationResult => ({
  applied: false,
  discoveredLocalFiles: 4,
  isolatedFiles: 2,
  missingReferences: 0,
  referencedFiles: 2,
  scannedFiles: 4,
  statusToActive: 0,
  statusToPending: 0,
  usageChanges: 0,
  usages: 3,
  ...overrides,
})

describe('reference reconcile UI flow', () => {
  it('stops after dry-run and reports up-to-date when there are no changes', async () => {
    const scan = vi.fn().mockResolvedValue(result())
    const confirm = vi.fn()
    const onUpToDate = vi.fn()

    await expect(
      runReferenceReconcileFlow({ confirm, onUpToDate, scan }),
    ).resolves.toBeNull()
    expect(scan).toHaveBeenCalledExactlyOnceWith(false)
    expect(confirm).not.toHaveBeenCalled()
    expect(onUpToDate).toHaveBeenCalledOnce()
  })

  it('does not apply after the user cancels a non-empty preview', async () => {
    const preview = result({ statusToPending: 1 })
    const scan = vi.fn().mockResolvedValue(preview)
    const confirm = vi.fn().mockResolvedValue(false)

    await expect(
      runReferenceReconcileFlow({
        confirm,
        onUpToDate: vi.fn(),
        scan,
      }),
    ).resolves.toBeNull()
    expect(scan).toHaveBeenCalledExactlyOnceWith(false)
    expect(confirm).toHaveBeenCalledWith(preview)
  })

  it('applies after confirmation, including usage-only repairs', async () => {
    const preview = result({ usageChanges: 2 })
    const applied = result({ applied: true, usageChanges: 2 })
    const scan = vi
      .fn()
      .mockResolvedValueOnce(preview)
      .mockResolvedValueOnce(applied)

    await expect(
      runReferenceReconcileFlow({
        confirm: vi.fn().mockResolvedValue(true),
        onUpToDate: vi.fn(),
        scan,
      }),
    ).resolves.toEqual(applied)
    expect(scan.mock.calls).toEqual([[false], [true]])
    expect(hasReferenceReconcileChanges(preview)).toBe(true)
  })
})
