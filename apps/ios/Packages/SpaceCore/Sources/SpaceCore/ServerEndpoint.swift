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

    /// Owner credentials require TLS on public and local networks.
    public init(baseURL: URL) throws {
        guard let scheme = baseURL.scheme?.lowercased(), let host = baseURL.host() else {
            throw SpaceTransportError.invalidServerURL(baseURL.absoluteString)
        }
        if scheme == "http" {
            throw SpaceTransportError.insecureScheme(host)
        }
        guard scheme == "http" || scheme == "https" else {
            throw SpaceTransportError.invalidServerURL(baseURL.absoluteString)
        }
        self.baseURL = baseURL
    }

    public var credentialOrigin: String {
        var origin = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)!
        origin.scheme = origin.scheme?.lowercased()
        origin.host = origin.host?.lowercased()
        origin.user = nil
        origin.password = nil
        origin.path = ""
        origin.query = nil
        origin.fragment = nil
        origin.port = baseURL.port == 443 ? nil : baseURL.port
        return origin.string!
    }
}
