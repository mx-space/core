import Foundation
import Testing

@testable import SpaceCore

@Suite struct PushActivationServiceTests {
    @Test func activatesPrivatePushBinding() async throws {
        let transport = StubTransport([
            .init(
                operationID: "activatePushNotifications",
                status: .created,
                json: #"{"data":{"enabled":true,"relay_url":"https://push.example.com","binding_id":"binding-1"}}"#
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

        #expect(activated.enabled)
        #expect(activated.bindingID == "binding-1")
        #expect(transport.operationIDs == ["activatePushNotifications"])
        let activationBody = try #require(transport.requestBodies.first)
        #expect(activationBody.contains("activationTicket"))
        #expect(activationBody.contains("relayUrl"))
        #expect(!activationBody.contains("apns"))
    }

    @Test func readsAndRevokesBindingThroughRelayInstallationAuth() async throws {
        let requests = RequestRecorder()
        let configuration = try PushConfiguration(
            relayURL: URL(string: "https://push.example.com")!,
            appID: "space",
            environment: .production
        )
        let client = PushRelayClient(configuration: configuration) { request in
            await requests.append(request)
            let status = request.httpMethod == "DELETE" ? 200 : 200
            let body = request.httpMethod == "DELETE"
                ? #"{"revoked":true}"#
                : #"{"binding_id":"binding-1","source_id":"source-1","installation_id":"install-1","reader_id":"reader-1","preferences":{"content_post":true,"content_note":true,"content_recently":true,"comment_replied":true}}"#
            return (
                Data(body.utf8),
                HTTPURLResponse(
                    url: request.url!,
                    statusCode: status,
                    httpVersion: nil,
                    headerFields: nil
                )!
            )
        }
        let credential = PushInstallationCredential(
            installationID: "install-1",
            installationSecret: "secret-1",
            bindingID: "binding-1"
        )

        let binding = try await client.binding(
            bindingID: "binding-1",
            credential: credential
        )
        try await client.revokeBinding(
            bindingID: "binding-1",
            credential: credential
        )

        #expect(binding.bindingID == "binding-1")
        #expect(binding.readerID == "reader-1")
        let recorded = await requests.values
        #expect(recorded.map(\.httpMethod) == ["GET", "DELETE"])
        #expect(recorded.allSatisfy {
            $0.value(forHTTPHeaderField: "Authorization") ==
                "Installation install-1.secret-1"
        })
    }

    @Test func decodesLegacyCredentialWithoutBindingID() throws {
        let credential = try JSONDecoder().decode(
            PushInstallationCredential.self,
            from: Data(#"{"installationID":"install-1","installationSecret":"secret-1"}"#.utf8)
        )

        #expect(credential.bindingID == nil)
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

private actor RequestRecorder {
    private(set) var values: [URLRequest] = []

    func append(_ request: URLRequest) {
        values.append(request)
    }
}
