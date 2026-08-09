import Foundation

public typealias RecentlyCard = Components.Schemas.RecentlyCard
public typealias RecentlyDetail = Components.Schemas.RecentlyDetail
public typealias EnrichmentResult = Components.Schemas.EnrichmentResult

public struct RecentlyService: Sendable {
    private let client: any APIProtocol

    public init(client: any APIProtocol) {
        self.client = client
    }

    public init(spaceClient: SpaceClient) {
        self.client = spaceClient.underlying
    }

    public func list(before: String? = nil, size: Int = 20) async throws -> [RecentlyCard] {
        switch try await client.listRecently(.init(query: .init(before: before, size: size))) {
        case let .ok(response):
            return try response.body.json.data
        case let .clientError(status, response):
            throw SpaceError(envelope: try response.body.json, status: status)
        case let .serverError(status, response):
            throw SpaceError(envelope: try response.body.json, status: status)
        case let .undocumented(statusCode, _):
            throw SpaceError.undocumented(statusCode)
        }
    }

    public func create(
        content: String,
        context: RecentlyContext? = nil,
        selectedEnrichmentURLs: [String]? = nil
    ) async throws -> RecentlyDetail {
        let body = makeBody(
            content: content,
            context: context,
            clearContext: false,
            selectedEnrichmentURLs: selectedEnrichmentURLs
        )
        switch try await client.createRecently(.init(body: .json(body))) {
        case let .created(response):
            return try response.body.json.data
        case let .clientError(status, response):
            throw SpaceError(envelope: try response.body.json, status: status)
        case let .serverError(status, response):
            throw SpaceError(envelope: try response.body.json, status: status)
        case let .undocumented(statusCode, _):
            throw SpaceError.undocumented(statusCode)
        }
    }

    public func update(
        id: String,
        content: String,
        context: RecentlyContext? = nil,
        clearContext: Bool = false,
        selectedEnrichmentURLs: [String]? = nil
    ) async throws -> RecentlyDetail {
        let input = Operations.UpdateRecently.Input(
            path: .init(id: id),
            body: .json(
                makeBody(
                    content: content,
                    context: context,
                    clearContext: clearContext,
                    selectedEnrichmentURLs: selectedEnrichmentURLs
                )
            )
        )
        switch try await client.updateRecently(input) {
        case let .ok(response):
            return try response.body.json.data
        case let .clientError(status, response):
            throw SpaceError(envelope: try response.body.json, status: status)
        case let .serverError(status, response):
            throw SpaceError(envelope: try response.body.json, status: status)
        case let .undocumented(statusCode, _):
            throw SpaceError.undocumented(statusCode)
        }
    }

    public func delete(id: String) async throws {
        switch try await client.deleteRecently(.init(path: .init(id: id))) {
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

    public func refCandidates(
        search: String = "",
        size: Int = 12
    ) async throws -> [RecentlyContext] {
        let input = Operations.ListRecentlyRefCandidates.Input(
            query: .init(search: search.isEmpty ? nil : search, size: size)
        )
        switch try await client.listRecentlyRefCandidates(input) {
        case let .ok(response):
            return try response.body.json.data.map(RecentlyContext.init)
        case let .clientError(status, response):
            throw SpaceError(envelope: try response.body.json, status: status)
        case let .serverError(status, response):
            throw SpaceError(envelope: try response.body.json, status: status)
        case let .undocumented(statusCode, _):
            throw SpaceError.undocumented(statusCode)
        }
    }

    /// Previews the media card a URL will produce. The server answers 204 when
    /// the matching provider is disabled or missing credentials, which is a
    /// "nothing to show" rather than a failure.
    public func resolve(url: String) async throws -> EnrichmentResult? {
        switch try await client.resolveEnrichment(.init(query: .init(url: url))) {
        case let .ok(response):
            return try response.body.json.data
        case let .clientError(status, response):
            throw SpaceError(envelope: try response.body.json, status: status)
        case let .serverError(status, response):
            throw SpaceError(envelope: try response.body.json, status: status)
        case let .undocumented(statusCode, _):
            guard statusCode == 204 else { throw SpaceError.undocumented(statusCode) }
            return nil
        }
    }

    /// URLs the server will turn into media cards.
    ///
    /// `UrlExtractorService.extractFromMarkdown` runs the content through
    /// `marked` and only picks up a link that is the *sole content of its
    /// paragraph*. A single newline is not a paragraph break in markdown, so
    /// `text\nhttps://…` stays one paragraph and is never cardified — verified
    /// against a live instance. Anything looser here would promise a card the
    /// server is not going to attach.
    public static func cardableURLs(in text: String) -> [String] {
        paragraphs(of: text).compactMap { paragraph in
            let trimmed = paragraph.trimmingCharacters(in: .whitespacesAndNewlines)
            return isBareLink(trimmed) ? trimmed : nil
        }
    }

    public static func firstCardableURL(in text: String) -> String? {
        cardableURLs(in: text).first
    }

    /// Every link in the text, wherever it sits. Used to preview what a link
    /// resolves to while composing, even when it is not yet cardifiable.
    public static func detectedURLs(in text: String) -> [String] {
        let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue)
        let range = NSRange(text.startIndex..., in: text)
        return detector?
            .matches(in: text, range: range)
            .compactMap { match -> String? in
                guard let url = match.url, let scheme = url.scheme?.lowercased(),
                      scheme == "http" || scheme == "https"
                else { return nil }
                return url.absoluteString
            } ?? []
    }

    public static func firstDetectedURL(in text: String) -> String? {
        detectedURLs(in: text).first
    }

    /// Rewrites `text` so `url` becomes its own paragraph, which is what makes
    /// the server cardify it.
    public static func isolatingLink(_ url: String, in text: String) -> String {
        guard let range = text.range(of: url) else { return text }
        let before = String(text[text.startIndex..<range.lowerBound])
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let after = String(text[range.upperBound...])
            .trimmingCharacters(in: .whitespacesAndNewlines)

        return [before, url, after]
            .filter { !$0.isEmpty }
            .joined(separator: "\n\n")
    }

    public static func preparing(
        content: String,
        selectedEnrichmentURLs: [String]
    ) -> String {
        selectedEnrichmentURLs.reduce(content) { partial, url in
            isolatingLink(url, in: partial)
        }
    }

    private static func paragraphs(of text: String) -> [String] {
        text
            .replacingOccurrences(of: "\r\n", with: "\n")
            .components(separatedBy: "\n\n")
    }

    private static func isBareLink(_ candidate: String) -> Bool {
        guard !candidate.isEmpty, !candidate.contains(where: \.isWhitespace) else {
            return false
        }
        guard let url = URL(string: candidate), let scheme = url.scheme?.lowercased() else {
            return false
        }
        return (scheme == "http" || scheme == "https") && url.host() != nil
    }

    private func makeBody(
        content: String,
        context: RecentlyContext?,
        clearContext: Bool,
        selectedEnrichmentURLs: [String]?
    ) -> Components.Schemas.RecentlyCreate {
        let refType = context.flatMap {
            Components.Schemas.RecentlyCreate.RefTypePayload(rawValue: $0.kind.rawValue)
        }
        let metadata = selectedEnrichmentURLs.map {
            Components.Schemas.RecentlyCreate.MetadataPayload(
                selectedEnrichmentUrls: Array(Set($0)).sorted()
            )
        }
        return .init(
            content: content,
            ref: context?.id,
            refType: refType,
            clearRef: clearContext ? true : nil,
            metadata: metadata
        )
    }
}
