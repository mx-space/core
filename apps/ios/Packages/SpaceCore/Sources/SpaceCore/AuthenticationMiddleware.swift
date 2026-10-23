import Foundation
import HTTPTypes
import OpenAPIRuntime

public struct AuthenticationMiddleware: ClientMiddleware {
    private let tokenStore: any TokenStore

    public init(tokenStore: any TokenStore) {
        self.tokenStore = tokenStore
    }

    public func intercept(
        _ request: HTTPRequest,
        body: HTTPBody?,
        baseURL: URL,
        operationID: String,
        next: (HTTPRequest, HTTPBody?, URL) async throws -> (HTTPResponse, HTTPBody?)
    ) async throws -> (HTTPResponse, HTTPBody?) {
        var request = request
        let pairingOperation = operationID == "requestDeviceCode" || operationID == "pollDeviceToken"
        if pairingOperation || baseURL.scheme?.lowercased() != "https" {
            request.headerFields[.authorization] = nil
        } else if let token = try? tokenStore.read(), !token.isEmpty {
            request.headerFields[.authorization] = "Bearer \(token)"
        }
        return try await next(request, body, baseURL)
    }
}
