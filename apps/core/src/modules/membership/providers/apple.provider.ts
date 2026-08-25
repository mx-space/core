import {
  Environment,
  type JWSRenewalInfoDecodedPayload,
  type JWSTransactionDecodedPayload,
  SignedDataVerifier,
} from '@apple/app-store-server-library'
import { Injectable, Logger } from '@nestjs/common'

import { AppErrorCode, createAppException } from '~/common/errors'

import { ConfigsService } from '../../configs/configs.service'
import type { MembershipPlan } from '../membership.types'
import { APPLE_ROOT_CA_PEMS } from './apple-root-cas'
import {
  type AppleDecodedTransaction,
  appleNotificationEventType,
  planFromAppleProductId,
} from './apple-transaction'
import type {
  BillingWebhookResult,
  PaymentProviderAdapter,
} from './provider.interface'

const appleRootCaBuffers = APPLE_ROOT_CA_PEMS.map((pem) => Buffer.from(pem))

@Injectable()
export class AppleProvider implements PaymentProviderAdapter {
  private readonly logger = new Logger(AppleProvider.name)

  constructor(private readonly configsService: ConfigsService) {}

  async createCheckout(_input: {
    reader: { id: string; email?: string | null; name?: string | null }
    plan: MembershipPlan
    returnUrl?: string
  }): Promise<{ checkoutUrl: string }> {
    throw createAppException(AppErrorCode.MEMBERSHIP_PROVIDER_NOT_CONFIGURED)
  }

  async verifySignedTransaction(
    signedTransactionInfo: string,
  ): Promise<AppleDecodedTransaction> {
    const membershipConfig = await this.configsService.get('membership')
    const bundleId = membershipConfig.appleBundleId?.trim()
    if (!bundleId) {
      throw createAppException(
        AppErrorCode.MEMBERSHIP_APPLE_TRANSACTION_INVALID,
      )
    }

    try {
      const decoded = await this.verifyTransactionWithFallback(
        signedTransactionInfo,
        bundleId,
        membershipConfig.appleAppAppleId,
      )
      if (
        (decoded.environment !== Environment.PRODUCTION &&
          decoded.environment !== Environment.SANDBOX) ||
        !decoded.transactionId ||
        !decoded.originalTransactionId ||
        !decoded.productId ||
        !decoded.expiresDate ||
        !decoded.signedDate
      ) {
        throw createAppException(
          AppErrorCode.MEMBERSHIP_APPLE_TRANSACTION_INVALID,
        )
      }
      return {
        appAccountToken: decoded.appAccountToken,
        environment:
          decoded.environment === Environment.PRODUCTION
            ? 'production'
            : 'sandbox',
        expiresDate: decoded.expiresDate,
        originalTransactionId: decoded.originalTransactionId,
        productId: decoded.productId,
        revocationDate: decoded.revocationDate,
        signedDate: decoded.signedDate,
        transactionId: decoded.transactionId,
      }
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === AppErrorCode.MEMBERSHIP_APPLE_TRANSACTION_INVALID
      ) {
        throw error
      }
      this.logger.warn(
        `Apple transaction verification failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
      throw createAppException(
        AppErrorCode.MEMBERSHIP_APPLE_TRANSACTION_INVALID,
      )
    }
  }

  async verifyAndParseWebhook(
    rawBody: Buffer | string,
    _headers: Record<string, string>,
  ): Promise<BillingWebhookResult> {
    const membershipConfig = await this.configsService.get('membership')
    const bundleId = membershipConfig.appleBundleId?.trim()
    if (!bundleId) {
      throw createAppException(AppErrorCode.WEBHOOK_SIGNATURE_INVALID)
    }

    let signedPayload: string
    try {
      const parsed = JSON.parse(
        typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8'),
      ) as { signedPayload?: string }
      if (!parsed.signedPayload) {
        throw new Error('missing signedPayload')
      }
      signedPayload = parsed.signedPayload
    } catch {
      throw createAppException(AppErrorCode.WEBHOOK_SIGNATURE_INVALID)
    }

    let notificationType: string
    let notificationSubtype: string
    let signedRenewalInfo: string | undefined
    let signedTransactionInfo: string | undefined
    let notificationUUID: string
    let notificationSignedDate: number | undefined
    try {
      const notification = await this.verifyNotificationWithFallback(
        signedPayload,
        bundleId,
        membershipConfig.appleAppAppleId,
      )
      notificationType = notification.notificationType ?? ''
      notificationSubtype = notification.subtype ?? ''
      notificationUUID = notification.notificationUUID ?? notificationType
      notificationSignedDate = notification.signedDate
      signedRenewalInfo = notification.data?.signedRenewalInfo
      signedTransactionInfo = notification.data?.signedTransactionInfo
      if (notification.data?.environment === Environment.SANDBOX) {
        return {
          ignored: true,
          rawType: notificationType,
          reason: 'sandbox_environment',
        }
      }
    } catch (error) {
      this.logger.warn(
        `Apple webhook verification failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
      throw createAppException(AppErrorCode.WEBHOOK_SIGNATURE_INVALID)
    }

    const type = appleNotificationEventType(notificationType)
    if (!type) {
      return {
        ignored: true,
        rawType: notificationType,
        reason: 'unsupported_event',
      }
    }

    if (!signedTransactionInfo) {
      return {
        ignored: true,
        rawType: notificationType,
        reason: 'missing_reader_metadata',
      }
    }

    const decoded = await this.verifyTransactionWithFallback(
      signedTransactionInfo,
      bundleId,
      membershipConfig.appleAppAppleId,
    ).catch(() => null)
    const occurredAt = notificationSignedDate ?? decoded?.signedDate
    if (
      decoded?.environment !== Environment.PRODUCTION ||
      !decoded?.originalTransactionId ||
      !decoded.expiresDate ||
      !Number.isFinite(occurredAt)
    ) {
      return {
        ignored: true,
        rawType: notificationType,
        reason: 'missing_reader_metadata',
      }
    }

    const monthlyProductId = membershipConfig.appleMonthlyProductId?.trim()
    const yearlyProductId = membershipConfig.appleYearlyProductId?.trim()
    const plan =
      decoded.productId && monthlyProductId && yearlyProductId
        ? (planFromAppleProductId(decoded.productId, {
            monthlyProductId,
            yearlyProductId,
          }) ?? undefined)
        : undefined

    let currentPeriodEnd = decoded.expiresDate
    let renewalInfo: JWSRenewalInfoDecodedPayload | undefined
    if (
      notificationType === 'DID_FAIL_TO_RENEW' &&
      notificationSubtype === 'GRACE_PERIOD'
    ) {
      renewalInfo = signedRenewalInfo
        ? await this.verifyRenewalInfoWithFallback(
            signedRenewalInfo,
            bundleId,
            membershipConfig.appleAppAppleId,
          ).catch(() => undefined)
        : undefined
      if (
        !renewalInfo?.gracePeriodExpiresDate ||
        (renewalInfo.originalTransactionId &&
          renewalInfo.originalTransactionId !== decoded.originalTransactionId)
      ) {
        return {
          ignored: true,
          rawType: notificationType,
          reason: 'missing_reader_metadata',
        }
      }
      currentPeriodEnd = renewalInfo.gracePeriodExpiresDate
    }

    return {
      event: {
        eventId: notificationUUID,
        provider: 'apple',
        type,
        customerId: decoded.appAccountToken ?? decoded.originalTransactionId,
        subscriptionId: decoded.originalTransactionId,
        plan,
        currentPeriodEnd: new Date(currentPeriodEnd),
        readerId: '',
        occurredAt: new Date(occurredAt!),
      },
      rawType: notificationType,
      rawPayload: {
        notificationType,
        notificationSubtype,
        decoded,
        renewalInfo,
      },
    }
  }

  private async verifyTransactionWithFallback(
    signedTransactionInfo: string,
    bundleId: string,
    appleAppAppleId?: string,
  ): Promise<JWSTransactionDecodedPayload> {
    const environments = this.environmentsToTry(appleAppAppleId)
    let lastError: unknown
    for (const { environment, appAppleId } of environments) {
      try {
        const verifier = new SignedDataVerifier(
          appleRootCaBuffers,
          true,
          environment,
          bundleId,
          appAppleId,
        )
        return await verifier.verifyAndDecodeTransaction(signedTransactionInfo)
      } catch (error) {
        lastError = error
      }
    }
    throw lastError instanceof Error ? lastError : new Error('verify failed')
  }

  private async verifyNotificationWithFallback(
    signedPayload: string,
    bundleId: string,
    appleAppAppleId?: string,
  ) {
    const environments = this.environmentsToTry(appleAppAppleId)
    let lastError: unknown
    for (const { environment, appAppleId } of environments) {
      try {
        const verifier = new SignedDataVerifier(
          appleRootCaBuffers,
          true,
          environment,
          bundleId,
          appAppleId,
        )
        return await verifier.verifyAndDecodeNotification(signedPayload)
      } catch (error) {
        lastError = error
      }
    }
    throw lastError instanceof Error ? lastError : new Error('verify failed')
  }

  private async verifyRenewalInfoWithFallback(
    signedRenewalInfo: string,
    bundleId: string,
    appleAppAppleId?: string,
  ): Promise<JWSRenewalInfoDecodedPayload> {
    const environments = this.environmentsToTry(appleAppAppleId)
    let lastError: unknown
    for (const { environment, appAppleId } of environments) {
      try {
        const verifier = new SignedDataVerifier(
          appleRootCaBuffers,
          true,
          environment,
          bundleId,
          appAppleId,
        )
        return await verifier.verifyAndDecodeRenewalInfo(signedRenewalInfo)
      } catch (error) {
        lastError = error
      }
    }
    throw lastError instanceof Error ? lastError : new Error('verify failed')
  }

  private environmentsToTry(appleAppAppleId?: string) {
    const appAppleId = Number(appleAppAppleId)
    const production =
      Number.isSafeInteger(appAppleId) && appAppleId > 0
        ? [
            {
              environment: Environment.PRODUCTION,
              appAppleId,
            },
          ]
        : []
    return [
      ...production,
      { environment: Environment.SANDBOX, appAppleId: undefined },
    ]
  }
}
