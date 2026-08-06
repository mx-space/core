import Foundation

/// Mirrors the server's `{ error: { code, message, details? } }` envelope.
public struct SpaceError: Error, Sendable, Equatable {
    public let code: String
    public let message: String
    public let status: Int?

    public init(code: String, message: String, status: Int? = nil) {
        self.code = code
        self.message = message
        self.status = status
    }

    public static let unauthorizedCodes: Set<String> = ["UNAUTHORIZED", "AUTH_FAILED"]

    public var isUnauthorized: Bool {
        status == 401 || SpaceError.unauthorizedCodes.contains(code)
    }

    /// Business failures are terminal for an optimistic write; transport
    /// failures are not, and the pending mutation queue may retry them.
    public var isRetryable: Bool {
        guard let status else { return true }
        return status >= 500
    }
}

extension SpaceError: LocalizedError {
    public var errorDescription: String? { message }
}

extension SpaceError {
    public init(envelope: Components.Schemas.ErrorEnvelope, status: Int) {
        self.init(
            code: envelope.error.code,
            message: envelope.error.message,
            status: status
        )
    }

    public static func undocumented(_ status: Int) -> SpaceError {
        SpaceError(
            code: "UNDOCUMENTED_RESPONSE",
            message: "Server returned an unexpected status \(status)",
            status: status
        )
    }
}

public enum SpaceTransportError: Error, Sendable, Equatable {
    case insecureScheme(String)
    case invalidServerURL(String)
}
