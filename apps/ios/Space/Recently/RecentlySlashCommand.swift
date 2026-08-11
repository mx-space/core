import SpaceCore

enum RecentlySlashCommand: String, CaseIterable, Identifiable {
    enum SearchScope {
        case context
        case tmdb
    }

    struct Invocation {
        let range: Range<String.Index>
        let query: String
    }

    case tmdb
    case context
    case post
    case note
    case page
    case recently

    var id: String { rawValue }
    var title: String { "/\(rawValue)" }

    var detailTitle: String {
        switch self {
        case .tmdb: "Search TMDB"
        case .context: "Search Space"
        case .post: "Find a post"
        case .note: "Find a note"
        case .page: "Find a page"
        case .recently: "Find a Recently entry"
        }
    }

    var summary: String {
        switch self {
        case .tmdb: "Search movies and TV"
        case .context: "Attach any Space content"
        case .post: "Find a post"
        case .note: "Find a note"
        case .page: "Find a page"
        case .recently: "Reference a Recently entry"
        }
    }

    var systemImage: String {
        switch self {
        case .tmdb: "film.stack.fill"
        case .context: "link"
        case .post: "doc.text.fill"
        case .note: "note.text"
        case .page: "doc.fill"
        case .recently: "text.bubble.fill"
        }
    }

    var searchScope: SearchScope {
        self == .tmdb ? .tmdb : .context
    }

    var contextKind: RecentlyContext.Kind? {
        switch self {
        case .tmdb, .context: nil
        case .post: .post
        case .note: .note
        case .page: .page
        case .recently: .recently
        }
    }

    static func invocation(in text: String) -> Invocation? {
        guard !text.isEmpty else { return nil }

        let start = text.lastIndex(where: \.isWhitespace)
            .map { text.index(after: $0) } ?? text.startIndex
        guard start < text.endIndex, text[start] == "/" else { return nil }

        let queryStart = text.index(after: start)
        let query = String(text[queryStart...]).lowercased()
        guard query.allSatisfy(\.isLetter) else { return nil }

        return Invocation(range: start ..< text.endIndex, query: query)
    }

    static func suggestions(for text: String) -> [Self] {
        guard let invocation = invocation(in: text) else { return [] }
        return allCases.filter { $0.rawValue.hasPrefix(invocation.query) }
    }
}
