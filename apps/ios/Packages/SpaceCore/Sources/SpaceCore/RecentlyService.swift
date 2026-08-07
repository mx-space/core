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

    public func create(content: String) async throws -> RecentlyDetail {
        switch try await client.createRecently(.init(body: .json(.init(content: content)))) {
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

    public func update(id: String, content: String) async throws -> RecentlyDetail {
        let input = Operations.UpdateRecently.Input(
            path: .init(id: id),
            body: .json(.init(content: content))
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

    public func searchTmdb(query: String, lang: String? = nil) async throws -> [EnrichmentResult] {
        let language = lang.flatMap(
            Operations.SearchTmdb.Input.Query.LangPayload.init(rawValue:)
        )
        let input = Operations.SearchTmdb.Input(
            query: .init(query: query, lang: language)
        )
        switch try await client.searchTmdb(input) {
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

    /// Returns the query from the last `/tmdb …` command that owns its line.
    /// An empty string means the command is active but has no query yet.
    public static func tmdbSearchQuery(in text: String) -> String? {
        tmdbCommand(in: text)?.query
    }

    /// Appends a discoverable TMDB command without disturbing existing copy.
    /// The blank paragraph keeps the eventual selected URL cardifiable.
    public static func appendingTmdbCommand(to text: String) -> String {
        guard tmdbCommand(in: text) == nil else { return text }
        let content = text.trimmingCharacters(in: .whitespacesAndNewlines)
        return content.isEmpty ? "/tmdb " : "\(content)\n\n/tmdb "
    }

    /// Replaces the active command with a canonical URL and isolates that URL
    /// as its own Markdown paragraph so mx-core will attach its enrichment.
    public static func replacingTmdbCommand(in text: String, with url: String) -> String {
        guard let command = tmdbCommand(in: text) else { return text }
        let before = String(text[..<command.range.lowerBound])
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let after = String(text[command.range.upperBound...])
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return [before, url, after]
            .filter { !$0.isEmpty }
            .joined(separator: "\n\n")
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

    private static func tmdbCommand(
        in text: String
    ) -> (range: Range<String.Index>, query: String)? {
        var match: (range: Range<String.Index>, query: String)?
        var lineStart = text.startIndex

        while lineStart <= text.endIndex {
            let lineEnd = text[lineStart...].firstIndex(of: "\n") ?? text.endIndex
            let range = lineStart..<lineEnd
            let line = text[range].trimmingCharacters(in: .whitespacesAndNewlines)
            if line.hasPrefix("/tmdb") {
                let suffix = line.dropFirst("/tmdb".count)
                if suffix.isEmpty || suffix.first?.isWhitespace == true {
                    match = (
                        range,
                        suffix.trimmingCharacters(in: .whitespacesAndNewlines)
                    )
                }
            }

            guard lineEnd < text.endIndex else { break }
            lineStart = text.index(after: lineEnd)
        }

        return match
    }
}
