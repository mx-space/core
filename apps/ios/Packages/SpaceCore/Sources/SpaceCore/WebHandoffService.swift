import Foundation

public enum WebHandoffTarget: String, CaseIterable, Sendable {
    case admin
    case analytics
    case comments
    case notes
    case posts
    case recently
    case settings
}

public struct WebHandoffService: Sendable {
    private let client: any APIProtocol
    private let endpoint: ServerEndpoint

    public init(client: any APIProtocol, endpoint: ServerEndpoint) {
        self.client = client
        self.endpoint = endpoint
    }

    public init(spaceClient: SpaceClient) {
        self.init(client: spaceClient.underlying, endpoint: spaceClient.endpoint)
    }

    public func makeURL(for target: WebHandoffTarget) async throws -> URL {
        let token: String
        switch try await client.generateWebHandoffToken() {
        case let .ok(response):
            token = try response.body.json.token
        case let .clientError(status, response):
            throw SpaceError(envelope: try response.body.json, status: status)
        case let .serverError(status, response):
            throw SpaceError(envelope: try response.body.json, status: status)
        case let .undocumented(statusCode, _):
            throw SpaceError.undocumented(statusCode)
        }

        var components = URLComponents(
            url: endpoint.apiURL.appending(path: "device/web-handoff"),
            resolvingAgainstBaseURL: false
        )
        components?.queryItems = [
            URLQueryItem(name: "token", value: token),
            URLQueryItem(name: "target", value: target.rawValue),
        ]
        guard let url = components?.url else {
            throw SpaceTransportError.invalidServerURL(endpoint.baseURL.absoluteString)
        }
        return url
    }
}
