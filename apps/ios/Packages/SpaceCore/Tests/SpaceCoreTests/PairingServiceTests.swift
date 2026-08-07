import Foundation
import HTTPTypes
import OpenAPIRuntime
import Testing

@testable import SpaceCore

@Suite struct PairingServiceTests {
    private let baseURL = URL(string: "https://mx.example.com")!
    private let start = Date(timeIntervalSince1970: 1_700_000_000)

    private func makeService(
        _ replies: [StubTransport.Reply],
        tokenStore: any TokenStore = InMemoryTokenStore(),
        clock: TestClock = TestClock()
    ) -> (PairingService, StubTransport) {
        let transport = StubTransport(replies)
        let client = Client(
            serverURL: baseURL.appending(path: "api/v3"),
            configuration: SpaceClient.configuration,
            transport: transport
        )
        let service = PairingService(
            client: client,
            baseURL: baseURL,
            tokenStore: tokenStore,
            now: { clock.now },
            sleep: { clock.advance(by: $0) }
        )
        return (service, transport)
    }

    private var codeReply: StubTransport.Reply {
        .init(
            status: .ok,
            json: """
            {"device_code":"dc-1","user_code":"ABCD1234",\
            "verification_uri":"/api/v3/device","expires_in":1800,"interval":5}
            """
        )
    }

    @Test func rebasesAbsoluteVerificationURIOnTheTypedAddress() async throws {
        let (service, _) = makeService([
            .init(
                status: .ok,
                json: """
                {"device_code":"dc","user_code":"UC",\
                "verification_uri":"http://localhost:2333/api/v3/device",\
                "verification_uri_complete":"http://localhost:2333/api/v3/device?user_code=UC",\
                "expires_in":60,"interval":5}
                """
            )
        ])

        let session = try await service.requestSession()

        #expect(
            session.verificationURL.absoluteString
                == "https://mx.example.com/api/v3/device?user_code=UC"
        )
    }

    @Test func resolvesRelativeVerificationURIAgainstTheInstance() async throws {
        let clock = TestClock(now: start)
        let (service, transport) = makeService([codeReply], clock: clock)

        let session = try await service.requestSession()

        #expect(session.userCode == "ABCD1234")
        #expect(session.deviceCode == "dc-1")
        #expect(session.verificationURL.absoluteString == "https://mx.example.com/api/v3/device")
        #expect(session.expiresAt == start.addingTimeInterval(1800))
        #expect(session.interval == .seconds(5))
        let body = try #require(transport.requestBodies.first.map(decodeJSON))
        #expect(body["client_id"] as? String == "space-ios")
    }

    private func decodeJSON(_ raw: String) -> [String: Any] {
        (try? JSONSerialization.jsonObject(with: Data(raw.utf8))) as? [String: Any] ?? [:]
    }

    @Test func rejectedClientSurfacesDistinctly() async throws {
        let (service, _) = makeService([
            .init(
                status: .badRequest,
                json: #"{"error":"invalid_client","error_description":"unsupported client_id: x"}"#
            )
        ])

        await #expect(throws: PairingError.rejectedClient) {
            try await service.requestSession()
        }
    }

    @Test func pollsThroughPendingUntilApproval() async throws {
        let store = InMemoryTokenStore()
        let (service, transport) = makeService(
            [
                codeReply,
                .init(status: .badRequest, json: #"{"error":"authorization_pending"}"#),
                .init(status: .badRequest, json: #"{"error":"authorization_pending"}"#),
                .init(
                    status: .ok,
                    json: #"{"access_token":"tok-9","token_type":"Bearer","expires_in":604800}"#
                ),
            ],
            tokenStore: store
        )

        let session = try await service.requestSession()
        try await service.waitForApproval(session)

        #expect(try store.read() == "tok-9")
        #expect(transport.remainingCount == 0)
    }

    @Test func slowDownBacksOffByFiveSeconds() async throws {
        let clock = TestClock(now: start)
        let (service, _) = makeService(
            [
                codeReply,
                .init(status: .badRequest, json: #"{"error":"slow_down"}"#),
                .init(
                    status: .ok,
                    json: #"{"access_token":"tok","token_type":"Bearer","expires_in":10}"#
                ),
            ],
            clock: clock
        )

        let session = try await service.requestSession()
        try await service.waitForApproval(session)

        #expect(clock.slept == [.seconds(5), .seconds(10)])
    }

    @Test func transientConnectionLossDoesNotAbortApprovalPolling() async throws {
        let clock = TestClock(now: start)
        let store = InMemoryTokenStore()
        let scripted = StubTransport([
            codeReply,
            .init(
                status: .ok,
                json: #"{"access_token":"tok","token_type":"Bearer","expires_in":10}"#
            ),
        ])
        let transport = FailFirstTokenPollTransport(scripted)
        let client = Client(
            serverURL: baseURL.appending(path: "api/v3"),
            configuration: SpaceClient.configuration,
            transport: transport
        )
        let service = PairingService(
            client: client,
            baseURL: baseURL,
            tokenStore: store,
            now: { clock.now },
            sleep: { clock.advance(by: $0) }
        )

        let session = try await service.requestSession()
        try await service.waitForApproval(session)

        #expect(try store.read() == "tok")
        #expect(clock.slept == [.seconds(5), .seconds(5)])
    }

    @Test func deniedApprovalStopsPolling() async throws {
        let store = InMemoryTokenStore()
        let (service, _) = makeService(
            [codeReply, .init(status: .badRequest, json: #"{"error":"access_denied"}"#)],
            tokenStore: store
        )

        let session = try await service.requestSession()
        await #expect(throws: PairingError.denied) {
            try await service.waitForApproval(session)
        }
        #expect(try store.read() == nil)
    }

    @Test func stopsPollingOnceTheCodeHasExpired() async throws {
        let clock = TestClock(now: start)
        let (service, transport) = makeService([codeReply], clock: clock)

        let session = try await service.requestSession()
        clock.set(session.expiresAt)

        await #expect(throws: PairingError.expired) {
            try await service.waitForApproval(session)
        }
        // Nothing was polled — the deadline is checked before each request.
        #expect(transport.remainingCount == 0)
        #expect(transport.requestBodies.count == 1)
    }
}

private final class FailFirstTokenPollTransport: ClientTransport, @unchecked Sendable {
    private let lock = NSLock()
    private var hasFailed = false
    private let underlying: StubTransport

    init(_ underlying: StubTransport) {
        self.underlying = underlying
    }

    func send(
        _ request: HTTPRequest,
        body: HTTPBody?,
        baseURL: URL,
        operationID: String
    ) async throws -> (HTTPResponse, HTTPBody?) {
        let shouldFail = lock.withLock {
            guard operationID == Operations.PollDeviceToken.id, !hasFailed else { return false }
            hasFailed = true
            return true
        }
        if shouldFail {
            throw URLError(.networkConnectionLost)
        }
        return try await underlying.send(
            request,
            body: body,
            baseURL: baseURL,
            operationID: operationID
        )
    }
}

final class TestClock: @unchecked Sendable {
    private let lock = NSLock()
    private var current: Date
    private var recorded: [Duration] = []

    init(now: Date = Date(timeIntervalSince1970: 1_700_000_000)) {
        self.current = now
    }

    var now: Date { lock.withLock { current } }
    var slept: [Duration] { lock.withLock { recorded } }

    func set(_ date: Date) {
        lock.withLock { current = date }
    }

    func advance(by duration: Duration) {
        lock.withLock {
            recorded.append(duration)
            current += TimeInterval(duration.components.seconds)
        }
    }
}
