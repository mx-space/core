import Foundation

public struct PushBindingStatus: Sendable, Equatable {
    public let configured: Bool
    public let enabled: Bool
    public let relayURL: URL?
    public let bindingID: String?
}

public struct PushActivationService: Sendable {
    private let client: any APIProtocol

    public init(client: any APIProtocol) {
        self.client = client
    }

    public init(spaceClient: SpaceClient) {
        client = spaceClient.underlying
    }

    public func activate(relayURL: URL, ticket: String) async throws -> PushBindingStatus {
        let input = Operations.ActivatePushNotifications.Input(
            body: .json(.init(relayUrl: relayURL.absoluteString, activationTicket: ticket))
        )
        switch try await client.activatePushNotifications(input) {
        case let .created(response):
            let data = try response.body.json.data
            return PushBindingStatus(
                configured: true,
                enabled: data.enabled,
                relayURL: URL(string: data.relayUrl),
                bindingID: data.bindingId
            )
        case let .clientError(status, response):
            throw SpaceError(envelope: try response.body.json, status: status)
        case let .serverError(status, response):
            throw SpaceError(envelope: try response.body.json, status: status)
        case let .undocumented(statusCode, _):
            throw SpaceError.undocumented(statusCode)
        }
    }

    public func status() async throws -> PushBindingStatus {
        switch try await client.getPushNotificationStatus() {
        case let .ok(response):
            let data = try response.body.json.data
            return PushBindingStatus(
                configured: data.configured,
                enabled: data.enabled,
                relayURL: data.relayUrl.flatMap(URL.init(string:)),
                bindingID: data.bindingId
            )
        case let .clientError(status, response):
            throw SpaceError(envelope: try response.body.json, status: status)
        case let .serverError(status, response):
            throw SpaceError(envelope: try response.body.json, status: status)
        case let .undocumented(statusCode, _):
            throw SpaceError.undocumented(statusCode)
        }
    }

    public func deactivate(bindingID: String) async throws {
        let input = Operations.DeactivatePushNotifications.Input(
            path: .init(bindingId: bindingID)
        )
        switch try await client.deactivatePushNotifications(input) {
        case .noContent:
            return
        case let .clientError(status, response):
            throw SpaceError(envelope: try response.body.json, status: status)
        case let .serverError(status, response):
            throw SpaceError(envelope: try response.body.json, status: status)
        case let .undocumented(statusCode, _):
            throw SpaceError.undocumented(statusCode)
        }
    }
}
