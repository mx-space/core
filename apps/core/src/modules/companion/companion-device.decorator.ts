import type { ExecutionContext } from '@nestjs/common'
import {
  applyDecorators,
  createParamDecorator,
  SetMetadata,
  UseGuards,
} from '@nestjs/common'

import type { CompanionDeviceScope } from '~/database/schema'
import { getNestExecutionContextRequest } from '~/transformers/get-req.transformer'

import {
  COMPANION_DEVICE_SCOPE_METADATA,
  CompanionDeviceGuard,
  type CompanionDevicePrincipal,
} from './companion-device.guard'

export const CompanionDeviceAuth = (...scopes: CompanionDeviceScope[]) =>
  applyDecorators(
    SetMetadata(COMPANION_DEVICE_SCOPE_METADATA, scopes),
    UseGuards(CompanionDeviceGuard),
  )

export const CurrentCompanionDevice = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CompanionDevicePrincipal =>
    (
      getNestExecutionContextRequest(context) as unknown as {
        companionDevice: CompanionDevicePrincipal
      }
    ).companionDevice,
)
