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

@Suite struct PairingCredentialPrivacyTests {
    @Test(arguments: ["requestDeviceCode", "pollDeviceToken"])
    func pairingNeverSendsAPreviousToken(_ operation: String) async throws {
        let middleware = AuthenticationMiddleware(tokenStore: InMemoryTokenStore(token: "previous-owner-secret"))
        _ = try await middleware.intercept(
            HTTPRequest(method: .post, scheme: nil, authority: nil, path: "/device"),
            body: nil, baseURL: URL(string: "https://different.example/api/v3")!, operationID: operation
        ) { request, _, _ in
            #expect(request.headerFields[.authorization] == nil)
            return (HTTPResponse(status: .ok), nil)
        }
    }
}

@Suite struct CredentialTransportBoundaryTests {
    @Test(arguments: ["requestDeviceCode", "pollDeviceToken"])
    func removesPreviouslyAttachedHeadersFromPairing(_ operation: String) async throws {
        let middleware = AuthenticationMiddleware(tokenStore: InMemoryTokenStore(token: "old-token"))
        var request = HTTPRequest(method: .post, scheme: nil, authority: nil, path: "/device")
        request.headerFields[.authorization] = "Bearer previous-header"
        _ = try await middleware.intercept(request, body: nil, baseURL: URL(string: "https://different.example")!, operationID: operation) { request, _, _ in
            #expect(request.headerFields[.authorization] == nil)
            return (HTTPResponse(status: .ok), nil)
        }
    }
}
