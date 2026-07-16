import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

import {
  COMPANION_DEVICE_SCOPES,
  DEFAULT_COMPANION_DEVICE_SCOPES,
} from './companion-device.constants'

const normalizedName = z
  .string()
  .min(1)
  .refine((value) => value === value.trim(), 'Device name must be trimmed.')
  .refine(
    (value) => value === value.normalize('NFC'),
    'Device name must use Unicode NFC normalization.',
  )
  .refine(
    (value) => Array.from(value).length <= 120,
    'Device name exceeds its Unicode scalar limit.',
  )

export const CompanionDeviceScopeSchema = z.enum(COMPANION_DEVICE_SCOPES)

export const CreateCompanionPairingSchema = z
  .object({
    scopes: z
      .array(CompanionDeviceScopeSchema)
      .min(1)
      .max(COMPANION_DEVICE_SCOPES.length)
      .refine(
        (scopes) => new Set(scopes).size === scopes.length,
        'Device scopes must be unique.',
      )
      .default([...DEFAULT_COMPANION_DEVICE_SCOPES]),
  })
  .strict()

export const ClaimCompanionPairingSchema = z
  .object({
    pairingCode: z.string().min(1).max(32),
    deviceName: normalizedName,
  })
  .strict()

export const CompanionDeviceIdParamSchema = z
  .object({
    id: z.uuid(),
  })
  .strict()

export class CreateCompanionPairingDto extends createZodDto(
  CreateCompanionPairingSchema,
) {}

export class ClaimCompanionPairingDto extends createZodDto(
  ClaimCompanionPairingSchema,
) {}

export class CompanionDeviceIdParamDto extends createZodDto(
  CompanionDeviceIdParamSchema,
) {}
