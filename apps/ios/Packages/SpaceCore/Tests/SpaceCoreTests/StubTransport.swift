import Foundation
import HTTPTypes
import OpenAPIRuntime

/// Replays a queued script of responses so the generated client's real
/// encoding and decoding paths are exercised without a network.
final class StubTransport: ClientTransport, @unchecked Sendable {
    struct Reply {
        let status: HTTPResponse.Status
        let json: String
    }

    private let lock = NSLock()
    private var replies: [Reply]
    private(set) var requestBodies: [String] = []

    init(_ replies: [Reply]) {
        self.replies = replies
    }

    var remainingCount: Int { lock.withLock { replies.count } }

    func send(
        _ request: HTTPRequest,
        body: HTTPBody?,
        baseURL: URL,
        operationID: String
    ) async throws -> (HTTPResponse, HTTPBody?) {
        if let body {
            let data = try await Data(collecting: body, upTo: 1 << 20)
            lock.withLock { requestBodies.append(String(decoding: data, as: UTF8.self)) }
        }

        let reply = lock.withLock { replies.isEmpty ? nil : replies.removeFirst() }
        guard let reply else {
            throw StubTransportError.scriptExhausted(operationID)
        }

        var response = HTTPResponse(status: reply.status)
        response.headerFields[.contentType] = "application/json"
        return (response, HTTPBody(reply.json))
    }
}

enum StubTransportError: Error, Equatable {
    case scriptExhausted(String)
}
