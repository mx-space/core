import Foundation

public struct PushConfiguration: Sendable, Equatable {
    public enum APNsEnvironment: String, Sendable, Codable {
        case development
        case production
    }

    public let relayURL: URL
    public let appID: String
    public let environment: APNsEnvironment

    public init(relayURL: URL, appID: String, environment: APNsEnvironment) throws {
        guard let host = relayURL.host(), !appID.isEmpty else {
            throw SpaceTransportError.invalidServerURL(relayURL.absoluteString)
        }
        let isLocal = host == "localhost" || host == "127.0.0.1" || host == "::1" || host.hasSuffix(".local")
        guard relayURL.scheme == "https" || (relayURL.scheme == "http" && isLocal) else {
            throw SpaceTransportError.insecureScheme(host)
        }
        guard
            relayURL.user == nil,
            relayURL.password == nil,
            relayURL.query == nil,
            relayURL.fragment == nil,
            relayURL.path.isEmpty || relayURL.path == "/"
        else {
            throw SpaceTransportError.invalidServerURL(relayURL.absoluteString)
        }
        self.relayURL = relayURL
        self.appID = appID
        self.environment = environment
    }
}
