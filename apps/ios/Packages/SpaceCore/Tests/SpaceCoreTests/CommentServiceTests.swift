import Foundation
import Testing

@testable import SpaceCore

@Suite struct CommentServiceTests {
    @Test func loadsSelectedInboxAndCountsTogether() async throws {
        let transport = StubTransport([
            .init(
                operationID: "listComments",
                status: .ok,
                json: #"{"data":[{"id":"comment-1","author":"Ada","text":"Review this","state":2,"created_at":"2026-08-06T10:00:00Z","ref_type":"Post","ref_id":"post-1","country_code":"SG"}]}"#
            ),
            .init(
                operationID: "getCommentTabCounts",
                status: .ok,
                json: #"{"data":{"unread":2,"read":4,"junk":1,"whispers":0,"awaiting":3,"all":10}}"#
            ),
        ])
        let client = Client(
            serverURL: URL(string: "https://mx.example.com/api/v3")!,
            configuration: SpaceClient.configuration,
            transport: transport
        )

        let snapshot = try await CommentService(client: client).load(filter: .junk)

        #expect(snapshot.comments.first?.id == "comment-1")
        #expect(snapshot.comments.first?.state == 2)
        #expect(snapshot.counts.junk == 1)
        #expect(snapshot.counts.awaiting == 3)
        #expect(transport.requestPaths.contains(where: { $0.contains("tab=junk") }))
    }

    @Test func moderationActionUsesTypedStateBody() async throws {
        let transport = StubTransport([
            .init(operationID: "patchCommentState", status: .noContent, json: ""),
        ])
        let client = Client(
            serverURL: URL(string: "https://mx.example.com/api/v3")!,
            configuration: SpaceClient.configuration,
            transport: transport
        )

        try await CommentService(client: client).setState(id: "comment-1", state: 1)

        let body = try #require(transport.requestBodies.first?.data(using: .utf8))
        let object = try #require(
            JSONSerialization.jsonObject(with: body) as? [String: Int]
        )
        #expect(object["state"] == 1)
        #expect(transport.requestPaths.first?.contains("comment-1") == true)
    }
}
