import Foundation
import HTTPTypes
import OpenAPIRuntime
import Testing

@testable import SpaceCore

@Suite struct AuthenticationMiddlewareTests {
    private func intercept(token: String?) async throws -> HTTPRequest {
        let store = InMemoryTokenStore(token: token)
        let middleware = AuthenticationMiddleware(tokenStore: store)
        let captured = Captured()

        _ = try await middleware.intercept(
            HTTPRequest(method: .get, scheme: nil, authority: nil, path: "/health"),
            body: nil,
            baseURL: URL(string: "https://example.com/api/v3")!,
            operationID: "getHealth"
        ) { request, _, _ in
            captured.request = request
            return (HTTPResponse(status: .ok), nil)
        }

        return captured.request!
    }

    @Test func injectsBearerHeaderWhenTokenPresent() async throws {
        let request = try await intercept(token: "abc123")
        #expect(request.headerFields[.authorization] == "Bearer abc123")
    }

    @Test func omitsHeaderWhenUnpaired() async throws {
        let request = try await intercept(token: nil)
        #expect(request.headerFields[.authorization] == nil)
    }

    @Test func omitsHeaderForEmptyToken() async throws {
        let request = try await intercept(token: "")
        #expect(request.headerFields[.authorization] == nil)
    }
}

private final class Captured: @unchecked Sendable {
    var request: HTTPRequest?
}
