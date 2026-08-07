import Foundation

/// A self-hosted instance the client talks to.
///
/// `pathPrefix` is asserted against the bundled contract in `SpaceCoreTests`,
/// so a server-side `API_VERSION` bump cannot silently desync the client.
public struct ServerEndpoint: Sendable, Equatable {
    public static let pathPrefix = "/api/v3"

    public let baseURL: URL

    public var apiURL: URL {
        baseURL.appending(path: ServerEndpoint.pathPrefix.dropFirst())
    }

    /// Plaintext HTTP is accepted only for private and `.local` hosts, matching
    /// the `NSAllowsLocalNetworking` exception the app ships with. Public
    /// plaintext is refused outright rather than degraded.
    public init(baseURL: URL) throws {
        guard let scheme = baseURL.scheme?.lowercased(), let host = baseURL.host() else {
            throw SpaceTransportError.invalidServerURL(baseURL.absoluteString)
        }
        if scheme == "http", !ServerEndpoint.isLocalHost(host) {
            throw SpaceTransportError.insecureScheme(host)
        }
        guard scheme == "http" || scheme == "https" else {
            throw SpaceTransportError.invalidServerURL(baseURL.absoluteString)
        }
        self.baseURL = baseURL
    }

    static func isLocalHost(_ host: String) -> Bool {
        if host == "localhost" || host.hasSuffix(".local") { return true }
        let parts = host.split(separator: ".").compactMap { Int($0) }
        guard parts.count == 4, parts.allSatisfy({ (0...255).contains($0) }) else {
            return false
        }
        switch (parts[0], parts[1]) {
        case (10, _): return true
        case (127, _): return true
        case (192, 168): return true
        case (172, 16...31): return true
        default: return false
        }
    }
}
