import Foundation

public struct PairingSession: Sendable, Equatable {
    public let deviceCode: String
    public let userCode: String
    public let verificationURL: URL
    public let expiresAt: Date
    public let interval: Duration
}

public enum PairingError: Error, Sendable, Equatable {
    case denied
    case expired
    case rejectedClient
    case malformedResponse
    case server(String)
}

/// Drives the RFC 8628 device-authorization handshake: request a user code,
/// then poll until the operator approves it in a browser.
public actor PairingService {
    public static let clientID = "space-ios"

    private let client: any APIProtocol
    private let baseURL: URL
    private let tokenStore: any TokenStore
    private let now: @Sendable () -> Date
    private let sleep: @Sendable (Duration) async throws -> Void

    public init(
        client: any APIProtocol,
        baseURL: URL,
        tokenStore: any TokenStore,
        now: @escaping @Sendable () -> Date = Date.init,
        sleep: @escaping @Sendable (Duration) async throws -> Void = {
            try await Task.sleep(for: $0)
        }
    ) {
        self.client = client
        self.baseURL = baseURL
        self.tokenStore = tokenStore
        self.now = now
        self.sleep = sleep
    }

    public init(spaceClient: SpaceClient, tokenStore: any TokenStore) {
        self.init(
            client: spaceClient.underlying,
            baseURL: spaceClient.endpoint.baseURL,
            tokenStore: tokenStore
        )
    }

    public func requestSession() async throws -> PairingSession {
        let output = try await client.requestDeviceCode(
            .init(body: .json(.init(clientId: PairingService.clientID, scope: "openid")))
        )

        switch output {
        case let .ok(response):
            let payload = try response.body.json
            guard
                let verificationURL = PairingService.verificationURL(
                    uri: payload.verificationUriComplete ?? payload.verificationUri,
                    baseURL: baseURL
                )
            else {
                throw PairingError.malformedResponse
            }
            return PairingSession(
                deviceCode: payload.deviceCode,
                userCode: payload.userCode,
                verificationURL: verificationURL,
                expiresAt: now().addingTimeInterval(TimeInterval(payload.expiresIn)),
                interval: .seconds(payload.interval)
            )
        case let .clientError(_, response):
            throw PairingService.mapError(try response.body.json)
        case let .serverError(_, response):
            throw PairingService.mapError(try response.body.json)
        case let .undocumented(statusCode, _):
            throw PairingError.server("unexpected status \(statusCode)")
        }
    }

    /// Polls until approval, then persists the session token. Returns only on
    /// success; every terminal outcome surfaces as a `PairingError`.
    public func waitForApproval(_ session: PairingSession) async throws {
        var interval = session.interval

        while true {
            guard now() < session.expiresAt else { throw PairingError.expired }
            try await sleep(interval)

            let output = try await client.pollDeviceToken(
                .init(
                    body: .json(
                        .init(
                            grantType: .urn_colon_ietf_colon_params_colon_oauth_colon_grantType_colon_deviceCode,
                            deviceCode: session.deviceCode,
                            clientId: PairingService.clientID
                        )
                    )
                )
            )

            switch output {
            case let .ok(response):
                try tokenStore.write(try response.body.json.accessToken)
                return
            case let .clientError(_, response):
                let payload = try response.body.json
                switch payload.error {
                case .authorizationPending:
                    continue
                case .slowDown:
                    // RFC 8628 §3.5: back off by five seconds and keep polling.
                    interval += .seconds(5)
                default:
                    throw PairingService.mapError(payload)
                }
            case let .serverError(_, response):
                throw PairingService.mapError(try response.body.json)
            case let .undocumented(statusCode, _):
                throw PairingError.server("unexpected status \(statusCode)")
            }
        }
    }

    /// Re-roots the server's verification URI on the address the operator
    /// actually typed. A self-hosted instance is routinely reachable at a LAN
    /// address while its configured site URL names the public domain (or the
    /// wrong port); trusting the server's host would send the operator to a
    /// page they cannot open.
    static func verificationURL(uri: String, baseURL: URL) -> URL? {
        guard let components = URLComponents(string: uri) else { return nil }
        var rebased = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)
        rebased?.path = components.path
        rebased?.query = components.query
        return rebased?.url
    }

    private static func mapError(_ payload: Components.Schemas.DeviceError) -> PairingError {
        switch payload.error {
        case .accessDenied: .denied
        case .expiredToken: .expired
        case .invalidClient: .rejectedClient
        default: .server(payload.errorDescription ?? payload.error.rawValue)
        }
    }
}
