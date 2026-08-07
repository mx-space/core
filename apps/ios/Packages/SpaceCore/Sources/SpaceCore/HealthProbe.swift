import Foundation
import OpenAPIRuntime
import OpenAPIURLSession

/// Confirms a URL actually points at an mx-core instance before pairing starts,
/// so a typo fails on the setup screen rather than mid-handshake.
public struct HealthProbe: Sendable {
    private let transport: any ClientTransport

    public init(transport: any ClientTransport = URLSessionTransport()) {
        self.transport = transport
    }

    public func probe(_ endpoint: ServerEndpoint) async throws -> Bool {
        let client = Client(
            serverURL: endpoint.apiURL,
            configuration: SpaceClient.configuration,
            transport: transport
        )
        let output = try await client.getHealth()
        guard case let .ok(response) = output else { return false }
        return try response.body.json.data.ok
    }
}
