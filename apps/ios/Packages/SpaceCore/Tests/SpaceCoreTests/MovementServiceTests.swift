import Foundation
import Testing

@testable import SpaceCore

@Suite struct MovementServiceTests {
    @Test func combinesAnalyticsAndRankingsWithoutFetchingDashboardActivity() async throws {
        let transport = StubTransport([
            .init(
                operationID: "getAnalyzeAggregate",
                status: .ok,
                json: #"{"data":{"months":[],"paths":[{"count":8,"path":"/posts/hello"}],"today":[{"key":"pv","value":12,"hour":"10"}],"today_ips":["127.0.0.1"],"total":{"call_time":44,"uv":9},"weeks":[]}}"#
            ),
            .init(
                operationID: "getTopReadings",
                status: .ok,
                json: #"{"data":[{"count":7,"ref":{"id":"post-1","title":"Hello"},"ref_id":"post-1"}]}"#
            ),
        ])
        let client = Client(
            serverURL: URL(string: "https://mx.example.com/api/v3")!,
            configuration: SpaceClient.configuration,
            transport: transport
        )

        let snapshot = try await MovementService(client: client).load(days: 30)

        #expect(snapshot.aggregate.today.first?.value == 12)
        #expect(snapshot.aggregate.paths.first?.path == "/posts/hello")
        #expect(snapshot.topReadings.first?.ref?.title == "Hello")
        #expect(Set(transport.operationIDs) == [
            "getAnalyzeAggregate",
            "getTopReadings",
        ])
        #expect(transport.requestPaths.contains(where: { $0.contains("days=30") }))
    }
}
