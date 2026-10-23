import Foundation
import Testing

@testable import SpaceCore

@Suite struct ServerEndpointTests {
    @Test func acceptsHTTPS() throws {
        let endpoint = try ServerEndpoint(baseURL: URL(string: "https://example.com")!)
        #expect(endpoint.apiURL.absoluteString == "https://example.com/api/v3")
    }

    @Test(arguments: [
        "http://localhost:2333",
        "http://mx.local",
        "http://192.168.1.10:2333",
        "http://10.0.0.4",
        "http://172.16.0.1",
        "http://127.0.0.1:2333",
    ])
    func refusesPlaintextOnLocalNetworks(_ raw: String) {
        #expect(throws: SpaceTransportError.self) {
            _ = try ServerEndpoint(baseURL: URL(string: raw)!)
        }
    }

    @Test(arguments: ["http://example.com", "http://172.32.0.1", "http://8.8.8.8"])
    func refusesPublicPlaintext(_ raw: String) {
        #expect(throws: SpaceTransportError.self) {
            _ = try ServerEndpoint(baseURL: URL(string: raw)!)
        }
    }

    @Test func refusesNonHTTPSchemes() {
        #expect(throws: SpaceTransportError.self) {
            _ = try ServerEndpoint(baseURL: URL(string: "ftp://example.com")!)
        }
    }

    /// The generated client is built against a relative server URL, so the
    /// prefix lives in Swift. This pins it to the contract the server emits.
    @Test func pathPrefixMatchesBundledContract() throws {
        let contractURL = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appending(path: "Sources/SpaceCore/openapi.json")

        let document = try JSONSerialization.jsonObject(
            with: Data(contentsOf: contractURL)
        ) as? [String: Any]
        let servers = document?["servers"] as? [[String: Any]]
        let url = servers?.first?["url"] as? String

        #expect(url == ServerEndpoint.pathPrefix)
    }
}

@Suite struct CredentialOriginTests {
    @Test func canonicalizesTheOriginWithoutPathOrDefaultPort() throws {
        let first = try ServerEndpoint(baseURL: URL(string: "https://EXAMPLE.com:443/old/path")!)
        let second = try ServerEndpoint(baseURL: URL(string: "https://example.com")!)
        #expect(first.credentialOrigin == second.credentialOrigin)
        #expect(first.credentialOrigin != (try ServerEndpoint(baseURL: URL(string: "https://example.com:8443")!)).credentialOrigin)
    }
    @Test func acceptsAnHTTPSIPv6Origin() throws {
        let endpoint = try ServerEndpoint(baseURL: URL(string: "https://[::1]:8443")!)
        #expect(URL(string: endpoint.credentialOrigin)?.port == 8443)
    }
}
