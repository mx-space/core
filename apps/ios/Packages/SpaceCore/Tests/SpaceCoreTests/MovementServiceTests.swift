import Foundation
import Testing

@testable import SpaceCore

@Suite struct MovementServiceTests {
    @Test func combinesAnalyticsRankingsAndRecentActivity() async throws {
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
            .init(
                operationID: "getRecentActivities",
                status: .ok,
                json: #"{"data":{"comment":[{"author":"Ada","created_at":"2026-08-06T10:00:00Z","text":"Useful"}],"like":[{"created_at":"2026-08-06T11:00:00Z","id":"like-1","title":"Hello"}],"note":[{"id":"note-1","title":"Published note"}]}}"#
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
        #expect(snapshot.recent.comment.first?.author == "Ada")
        #expect(snapshot.recent.like.first?.id == "like-1")
        #expect(Set(transport.operationIDs) == [
            "getAnalyzeAggregate",
            "getTopReadings",
            "getRecentActivities",
        ])
        #expect(transport.requestPaths.contains(where: { $0.contains("days=30") }))
    }
}
