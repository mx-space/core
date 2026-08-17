import Foundation

public struct PushActivationTicket: Sendable, Equatable {
    public let ticket: String
    public let expiresAt: Date
}

public struct PushRelayBinding: Sendable, Equatable {
    public let bindingID: String
    public let readerID: String?
}

public enum PushRelayError: LocalizedError, Sendable {
    case invalidResponse
    case rejected(Int)

    public var errorDescription: String? {
        switch self {
        case .invalidResponse: "Push Relay returned an invalid response."
        case let .rejected(status): "Push Relay rejected the request (HTTP \(status))."
        }
    }
}

public struct PushRelayClient: Sendable {
    private struct InstallationResponse: Decodable {
        let installationID: String
        let installationSecret: String

        enum CodingKeys: String, CodingKey {
            case installationID = "installation_id"
            case installationSecret = "installation_secret"
        }
    }

    private struct TicketResponse: Decodable {
        let ticket: String
        let expiresAt: Date

        enum CodingKeys: String, CodingKey {
            case ticket
            case expiresAt = "expires_at"
        }
    }

    private struct BindingResponse: Decodable {
        let bindingID: String
        let readerID: String?

        enum CodingKeys: String, CodingKey {
            case bindingID = "binding_id"
            case readerID = "reader_id"
        }
    }

    private let configuration: PushConfiguration
    private let decoder: JSONDecoder
    private let requestData: @Sendable (URLRequest) async throws -> (Data, URLResponse)

    public init(configuration: PushConfiguration, session: URLSession = .shared) {
        self.configuration = configuration
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        self.decoder = decoder
        requestData = { request in try await session.data(for: request) }
    }

    init(
        configuration: PushConfiguration,
        requestData: @escaping @Sendable (URLRequest) async throws -> (Data, URLResponse)
    ) {
        self.configuration = configuration
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        self.decoder = decoder
        self.requestData = requestData
    }

    public func register(deviceToken: String) async throws -> PushInstallationCredential {
        var request = request(path: "v1/installations", method: "POST")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "app_id": configuration.appID,
            "apns_environment": configuration.environment.rawValue,
            "apns_token": deviceToken,
        ])
        let response: InstallationResponse = try await send(request, success: 201)
        return PushInstallationCredential(
            installationID: response.installationID,
            installationSecret: response.installationSecret
        )
    }

    public func update(
        deviceToken: String,
        credential: PushInstallationCredential
    ) async throws {
        var request = request(
            path: "v1/installations/\(credential.installationID)/token",
            method: "PUT"
        )
        request.setValue(authorization(credential), forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "apns_environment": configuration.environment.rawValue,
            "apns_token": deviceToken,
        ])
        let (_, response) = try await requestData(request)
        try validate(response, success: 200)
    }

    public func activationTicket(
        credential: PushInstallationCredential
    ) async throws -> PushActivationTicket {
        var request = request(path: "v1/source-activations", method: "POST")
        request.setValue(authorization(credential), forHTTPHeaderField: "Authorization")
        let response: TicketResponse = try await send(request, success: 201)
        return PushActivationTicket(ticket: response.ticket, expiresAt: response.expiresAt)
    }

    public func binding(
        bindingID: String,
        credential: PushInstallationCredential
    ) async throws -> PushRelayBinding {
        var request = request(path: "v1/bindings/\(bindingID)", method: "GET")
        request.setValue(authorization(credential), forHTTPHeaderField: "Authorization")
        let response: BindingResponse = try await send(request, success: 200)
        return PushRelayBinding(
            bindingID: response.bindingID,
            readerID: response.readerID
        )
    }

    public func revokeBinding(
        bindingID: String,
        credential: PushInstallationCredential
    ) async throws {
        var request = request(path: "v1/bindings/\(bindingID)", method: "DELETE")
        request.setValue(authorization(credential), forHTTPHeaderField: "Authorization")
        let (_, response) = try await requestData(request)
        try validate(response, success: 200)
    }

    private func request(path: String, method: String) -> URLRequest {
        var request = URLRequest(url: configuration.relayURL.appending(path: path))
        request.httpMethod = method
        request.timeoutInterval = 10
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        return request
    }

    private func authorization(_ credential: PushInstallationCredential) -> String {
        "Installation \(credential.installationID).\(credential.installationSecret)"
    }

    private func send<T: Decodable>(_ request: URLRequest, success: Int) async throws -> T {
        let (data, response) = try await requestData(request)
        try validate(response, success: success)
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw PushRelayError.invalidResponse
        }
    }

    private func validate(_ response: URLResponse, success: Int) throws {
        guard let http = response as? HTTPURLResponse else { throw PushRelayError.invalidResponse }
        guard http.statusCode == success else { throw PushRelayError.rejected(http.statusCode) }
    }
}
