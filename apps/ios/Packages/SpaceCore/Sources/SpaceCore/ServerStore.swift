import Foundation

/// Remembers which instance the device is paired with. The token lives in the
/// Keychain; only the address lives here.
public struct ServerStore: @unchecked Sendable {
    private static let key = "space.server.baseURL"

    // `UserDefaults` is thread-safe but not yet annotated as `Sendable`.
    private let defaults: UserDefaults

    public init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    public func read() -> ServerEndpoint? {
        guard
            let raw = defaults.string(forKey: ServerStore.key),
            let url = URL(string: raw)
        else { return nil }
        return try? ServerEndpoint(baseURL: url)
    }

    public func write(_ endpoint: ServerEndpoint) {
        defaults.set(endpoint.baseURL.absoluteString, forKey: ServerStore.key)
    }

    public func clear() {
        defaults.removeObject(forKey: ServerStore.key)
    }
}
