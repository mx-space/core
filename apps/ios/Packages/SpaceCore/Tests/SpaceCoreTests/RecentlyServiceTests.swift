import Foundation
import Testing

@testable import SpaceCore

@Suite struct RecentlyServiceTests {
    private func makeService(_ replies: [StubTransport.Reply]) -> (RecentlyService, StubTransport) {
        let transport = StubTransport(replies)
        let client = Client(
            serverURL: URL(string: "https://mx.example.com/api/v3")!,
            configuration: SpaceClient.configuration,
            transport: transport
        )
        return (RecentlyService(client: client), transport)
    }

    private var listReply: StubTransport.Reply {
        .init(
            status: .ok,
            json: """
            {"data":[{"id":"1","content":"listening https://music.example/x","type":"text",\
            "created_at":"2026-08-04T10:00:00.123Z","up":2,"comments_index":1,\
            "enrichments":{"https://music.example/x":{"id":"e1","title":"Some Album",\
            "description":"An artist","url":"https://music.example/x","category":"music",\
            "fetched_at":"2026-08-04T09:00:00Z","color":"#3366CC",\
            "thumbnail_image":{"url":"https://img.example/a.jpg","width":300,"height":300,\
            "palette":{"dominant":"#112233"}},\
            "attributes":[{"key":"rating","value":4.5,"label":"Rating"},\
            {"key":"explicit","value":false},{"key":"label","value":"Indie"}]}}}]}
            """
        )
    }

    @Test func projectsHydratedEnrichmentsIntoMediaCards() async throws {
        let (service, _) = makeService([listReply])

        let entries = try await service.list()
        let card = try #require(entries.first?.mediaCards.first)

        #expect(card.title == "Some Album")
        #expect(card.category == "music")
        #expect(card.variant == .poster(.album))
        #expect(card.accentHex == "#3366CC")
        #expect(card.artworkURL?.absoluteString == "https://img.example/a.jpg")
        #expect(
            card.attributes.map(\.value) == ["4.5", "no", "Indie"],
            "anyOf-boxed attribute values must flatten to display strings"
        )
        #expect(card.attributes.first?.label == "Rating")
    }

    @Test func mediaCardsAreOrderedByURLSoLayoutIsStable() async throws {
        let (service, _) = makeService([
            .init(
                status: .ok,
                json: """
                {"data":[{"id":"1","content":"two links","type":"text",\
                "created_at":"2026-08-04T10:00:00Z",\
                "enrichments":{\
                "https://b.example":{"title":"B","url":"https://b.example",\
                "category":"link","fetched_at":"2026-08-04T09:00:00Z"},\
                "https://a.example":{"title":"A","url":"https://a.example",\
                "category":"link","fetched_at":"2026-08-04T09:00:00Z"}}}]}
                """
            )
        ])

        let entries = try await service.list()
        #expect(entries.first?.mediaCards.map(\.title) == ["A", "B"])
    }

    @Test func fallsBackThroughPreviewAndCaptureArtwork() async throws {
        let (service, _) = makeService([
            .init(
                status: .ok,
                json: """
                {"data":[{"id":"1","content":"x","type":"text",\
                "created_at":"2026-08-04T10:00:00Z",\
                "enrichments":{"https://a.example":{"title":"A","url":"https://a.example",\
                "category":"link","fetched_at":"2026-08-04T09:00:00Z",\
                "capture_image":{"url":"https://img.example/c.png",\
                "palette":{"dominant":"#ABCDEF"}}}}}]}
                """
            )
        ])

        let card = try #require(try await service.list().first?.mediaCards.first)
        #expect(card.artworkURL?.absoluteString == "https://img.example/c.png")
        #expect(card.accentHex == "#ABCDEF")
    }

    @Test func resolveTreatsNoContentAsNothingToShow() async throws {
        let (service, _) = makeService([.init(status: .noContent, json: "")])
        #expect(try await service.resolve(url: "https://a.example") == nil)
    }

    @Test func searchesTMDBThroughTheAuthenticatedEnrichmentEndpoint() async throws {
        let (service, transport) = makeService([
            .init(
                operationID: "searchEnrichment",
                status: .ok,
                json: #"{"data":[{"title":"Dune","description":"A desert epic","url":"https://www.themoviedb.org/movie/438631","category":"media","subtype":"movie","published_at":"2021-09-15","fetched_at":"","thumbnail_image":{"url":"https://image.tmdb.org/t/p/w500/dune.jpg"}}]}"#
            ),
        ])

        let result = try #require(try await service.searchTMDB(query: "Dune", size: 6).first)

        #expect(result.title == "Dune")
        #expect(result.url == "https://www.themoviedb.org/movie/438631")
        #expect(transport.operationIDs == ["searchEnrichment"])
        #expect(transport.requestPaths.first?.contains("query=Dune") == true)
        #expect(transport.requestPaths.first?.contains("size=6") == true)
        #expect(transport.requestPaths.first?.contains("/enrichment/search/tmdb") == true)
    }

    /// Mirrors `UrlExtractorService.extractFromMarkdown`: only a link that owns
    /// its whole *paragraph* becomes a card. A single newline is not a
    /// paragraph break in markdown — verified against a live instance.
    @Test(arguments: [
        ("plain text", nil),
        ("see https://a.example/x now", nil),
        ("在读 https://a.example/x 很不错", nil),
        ("https://a.example/x", "https://a.example/x"),
        ("intro\n\nhttps://a.example/x", "https://a.example/x"),
        ("intro\nhttps://a.example/x", nil),
        ("  https://a.example/x  ", "https://a.example/x"),
        ("ftp://a.example/x", nil),
        ("https://a.example\n\nhttps://b.example", "https://a.example"),
    ])
    func onlyPreviewsLinksTheServerWillCardify(_ text: String, _ expected: String?) {
        #expect(RecentlyService.firstCardableURL(in: text) == expected)
    }

    /// Preview detection is deliberately looser than cardification so the
    /// author can still see what a mid-sentence link resolves to.
    @Test(arguments: [
        ("plain text", nil),
        ("在读 https://a.example/x 很不错", "https://a.example/x"),
        ("intro\nhttps://a.example/x", "https://a.example/x"),
        ("https://a.example/x", "https://a.example/x"),
    ])
    func detectsLinksAnywhereForPreview(_ text: String, _ expected: String?) {
        #expect(RecentlyService.firstDetectedURL(in: text) == expected)
    }

    @Test(arguments: [
        ("在读 https://a.example/x 很不错", "在读\n\nhttps://a.example/x\n\n很不错"),
        ("intro\nhttps://a.example/x", "intro\n\nhttps://a.example/x"),
        ("https://a.example/x", "https://a.example/x"),
        ("trailing https://a.example/x", "trailing\n\nhttps://a.example/x"),
    ])
    func isolatingALinkMakesItCardifiable(_ text: String, _ expected: String) {
        let url = try! #require(RecentlyService.firstDetectedURL(in: text))
        let rewritten = RecentlyService.isolatingLink(url, in: text)
        #expect(rewritten == expected)
        #expect(RecentlyService.firstCardableURL(in: rewritten) == url)
    }

    @Test func preparingAppendsASelectedSearchResultAsACardifiableLink() {
        let url = "https://www.themoviedb.org/movie/438631"
        let prepared = RecentlyService.preparing(
            content: "Watched Dune tonight.",
            selectedEnrichmentURLs: [url]
        )

        #expect(prepared == "Watched Dune tonight.\n\n\(url)")
        #expect(RecentlyService.cardableURLs(in: prepared) == [url])
    }

    @Test func deleteRollsBackNothingOnSuccess() async throws {
        let (service, transport) = makeService([.init(status: .noContent, json: "")])
        try await service.delete(id: "1")
        #expect(transport.remainingCount == 0)
    }

    @Test func updateSendsTheEditedContentToTheSelectedEntry() async throws {
        let (service, transport) = makeService([
            .init(
                status: .ok,
                json: #"{"data":{"id":"1","content":"edited","type":"text","metadata":null,"ref_type":null,"ref_id":null,"comments_index":0,"allow_comment":true,"up":0,"down":0,"created_at":"2026-08-04T19:06:00Z","modified_at":"2026-08-07T03:00:00Z","enrichments":{}}}"#
            ),
        ])

        let entry = try await service.update(id: "1", content: "edited")
        let body = try #require(transport.requestBodies.first?.data(using: .utf8))
        let object = try #require(
            JSONSerialization.jsonObject(with: body) as? [String: String]
        )

        #expect(entry.content == "edited")
        #expect(object["content"] == "edited")
        #expect(transport.requestPaths.first?.contains("/recently/1") == true)
    }

    @Test func editCanClearContextAndPersistTheSelectedLinkSet() async throws {
        let (service, transport) = makeService([
            .init(
                status: .ok,
                json: #"{"data":{"id":"1","content":"edited","type":"link","metadata":{"selected_enrichment_urls":["https://a.example"]},"ref_type":null,"ref_id":null,"comments_index":0,"allow_comment":true,"up":0,"down":0,"created_at":"2026-08-04T19:06:00Z","modified_at":"2026-08-07T03:00:00Z","enrichments":{}}}"#
            ),
        ])

        _ = try await service.update(
            id: "1",
            content: "edited",
            clearContext: true,
            selectedEnrichmentURLs: ["https://a.example"]
        )
        let body = try #require(transport.requestBodies.first?.data(using: .utf8))
        let object = try #require(
            JSONSerialization.jsonObject(with: body) as? [String: Any]
        )
        let metadata = try #require(object["metadata"] as? [String: Any])

        #expect(object["clearRef"] as? Bool == true)
        #expect(metadata["selectedEnrichmentUrls"] as? [String] == ["https://a.example"])
    }

    @Test func loadsTypedInternalContextCandidates() async throws {
        let (service, transport) = makeService([
            .init(
                operationID: "listRecentlyRefCandidates",
                status: .ok,
                json: #"{"data":[{"id":"post-1","type":"post","title":"Design notes"}]}"#
            ),
        ])

        let candidates = try await service.refCandidates(search: "design", size: 8)

        #expect(candidates == [
            RecentlyContext(id: "post-1", kind: .post, title: "Design notes"),
        ])
        #expect(transport.requestPaths.first?.contains("search=design") == true)
        #expect(transport.requestPaths.first?.contains("size=8") == true)
    }

    @Test func responseMetadataRestoresAnExplicitLinkSelection() async throws {
        let (service, _) = makeService([
            .init(
                status: .ok,
                json: #"{"data":[{"id":"1","content":"https://a.example\n\nhttps://b.example","type":"link","created_at":"2026-08-04T10:00:00Z","metadata":{"selected_enrichment_urls":["https://b.example"]},"enrichments":{}}]}"#
            ),
        ])

        let entry = try #require(try await service.list().first)
        #expect(entry.selectedEnrichmentURLs == ["https://b.example"])
    }
}
