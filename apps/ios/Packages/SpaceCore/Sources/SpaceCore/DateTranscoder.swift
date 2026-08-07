import Foundation
import OpenAPIRuntime

/// mx-core serializes timestamps with `Date.prototype.toISOString()`, which
/// always emits milliseconds (`2026-08-04T18:27:30.809Z`). The runtime's
/// default transcoder only parses whole seconds and throws on the fractional
/// form, so every payload carrying a date fails to decode without this.
struct MillisecondTolerantDateTranscoder: DateTranscoder {
    private static func formatter(fractional: Bool) -> ISO8601DateFormatter {
        // `ISO8601DateFormatter` is not `Sendable`, so each call gets its own
        // rather than sharing one across concurrent decodes.
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = fractional
            ? [.withInternetDateTime, .withFractionalSeconds]
            : [.withInternetDateTime]
        return formatter
    }

    func encode(_ date: Date) throws -> String {
        Self.formatter(fractional: true).string(from: date)
    }

    func decode(_ string: String) throws -> Date {
        if let date = Self.formatter(fractional: true).date(from: string) { return date }
        if let date = Self.formatter(fractional: false).date(from: string) { return date }
        throw DecodingError.dataCorrupted(
            .init(
                codingPath: [],
                debugDescription: "Expected an ISO 8601 date, got \"\(string)\""
            )
        )
    }
}
