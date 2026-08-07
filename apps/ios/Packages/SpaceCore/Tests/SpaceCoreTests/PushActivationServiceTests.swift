import Foundation
import Testing

@testable import SpaceCore

@Suite struct PushActivationServiceTests {
    @Test func activatesAndReadsPrivatePushBinding() async throws {
        let transport = StubTransport([
            .init(
                operationID: "activatePushNotifications",
                status: .created,
                json: #"{"data":{"enabled":true,"relay_url":"https://push.example.com","binding_id":"binding-1"}}"#
            ),
            .init(
                operationID: "getPushNotificationStatus",
                status: .ok,
                json: #"{"data":{"configured":true,"enabled":true,"relay_url":"https://push.example.com","binding_id":"binding-1"}}"#
            ),
            .init(
                operationID: "deactivatePushNotifications",
                status: .noContent,
                json: ""
            ),
        ])
        let client = Client(
            serverURL: URL(string: "https://core.example.com/api/v3")!,
            configuration: SpaceClient.configuration,
            transport: transport
        )
        let service = PushActivationService(client: client)

        let activated = try await service.activate(
            relayURL: URL(string: "https://push.example.com")!,
            ticket: "act_abcdefghijklmnopqrstuvwxyz012345"
        )
        let status = try await service.status()
        try await service.deactivate(bindingID: "binding-1")

        #expect(activated.enabled)
        #expect(activated.bindingID == "binding-1")
        #expect(status.relayURL == URL(string: "https://push.example.com"))
        #expect(transport.operationIDs == [
            "activatePushNotifications",
            "getPushNotificationStatus",
            "deactivatePushNotifications",
        ])
        let activationBody = try #require(transport.requestBodies.first)
        #expect(activationBody.contains("activationTicket"))
        #expect(activationBody.contains("relayUrl"))
        #expect(!activationBody.contains("apns"))
    }

    @Test func validatesRelayTransportBoundary() throws {
        #expect(throws: Never.self) {
            try PushConfiguration(
                relayURL: URL(string: "https://push.example.com")!,
                appID: "space",
                environment: .production
            )
        }
        #expect(throws: SpaceTransportError.self) {
            try PushConfiguration(
                relayURL: URL(string: "http://push.example.com")!,
                appID: "space",
                environment: .development
            )
        }
    }
}
