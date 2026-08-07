import Foundation
import OpenAPIRuntime
import OpenAPIURLSession

public struct SpaceClient: Sendable {
    public static let configuration = Configuration(
        dateTranscoder: MillisecondTolerantDateTranscoder()
    )

    public let endpoint: ServerEndpoint
    public let underlying: Client

    public init(
        endpoint: ServerEndpoint,
        tokenStore: any TokenStore,
        transport: any ClientTransport = URLSessionTransport()
    ) {
        self.endpoint = endpoint
        self.underlying = Client(
            serverURL: endpoint.apiURL,
            configuration: SpaceClient.configuration,
            transport: transport,
            middlewares: [AuthenticationMiddleware(tokenStore: tokenStore)]
        )
    }
}
