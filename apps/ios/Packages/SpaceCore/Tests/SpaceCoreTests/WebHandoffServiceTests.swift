import Foundation
import Testing

@testable import SpaceCore

@Suite struct WebHandoffServiceTests {
    @Test func buildsSingleUseHandoffURLForRequestedWebArea() async throws {
        let transport = StubTransport([
            .init(
                operationID: "generateWebHandoffToken",
                status: .ok,
                json: #"{"token":"space token/+"}"#
            ),
        ])
        let client = Client(
            serverURL: URL(string: "http://127.0.0.1:2444/api/v3")!,
            configuration: SpaceClient.configuration,
            transport: transport
        )
        let endpoint = try ServerEndpoint(baseURL: URL(string: "http://127.0.0.1:2444")!)
        let service = WebHandoffService(client: client, endpoint: endpoint)

        let url = try await service.makeURL(for: .comments)
        let components = try #require(URLComponents(url: url, resolvingAgainstBaseURL: false))

        #expect(components.path == "/api/v3/device/web-handoff")
        #expect(components.queryItems?.first(where: { $0.name == "token" })?.value == "space token/+")
        #expect(components.queryItems?.first(where: { $0.name == "target" })?.value == "comments")
        #expect(transport.operationIDs == ["generateWebHandoffToken"])
    }
}
