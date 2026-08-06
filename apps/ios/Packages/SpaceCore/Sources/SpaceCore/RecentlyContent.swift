import Foundation

/// One renderable piece of a recently entry.
///
/// Yohaku renders the entry as markdown and swaps a bare-link paragraph for a
/// media card *in place*. Splitting the content into blocks reproduces that
/// ordering without pulling a markdown engine onto the phone.
public enum RecentlyBlock: Sendable, Equatable, Identifiable {
    case text(String)
    case card(MediaCard)

    public var id: String {
        switch self {
        case let .text(value): "text:\(value.hashValue)"
        case let .card(card): "card:\(card.id)"
        }
    }
}

extension RecentlyCard {
    /// Media cards keyed by the URL the server found, ordered by URL.
    public var mediaCards: [MediaCard] {
        (enrichments?.additionalProperties ?? [:])
            .sorted { $0.key < $1.key }
            .map { MediaCard($0.value) }
    }

    /// The entry laid out as text runs interleaved with the cards that replace
    /// their links. A link with no hydrated enrichment stays as plain text so
    /// nothing silently disappears.
    public var blocks: [RecentlyBlock] {
        let cards = Dictionary(
            (enrichments?.additionalProperties ?? [:]).map { ($0.key, MediaCard($0.value)) },
            uniquingKeysWith: { first, _ in first }
        )

        var blocks: [RecentlyBlock] = []
        var pending: [String] = []

        func flush() {
            let text = pending
                .joined(separator: "\n")
                .trimmingCharacters(in: .whitespacesAndNewlines)
            if !text.isEmpty { blocks.append(.text(text)) }
            pending.removeAll()
        }

        for line in content.components(separatedBy: "\n") {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            if let card = cards[trimmed] {
                flush()
                blocks.append(.card(card))
            } else {
                pending.append(line)
            }
        }
        flush()

        return blocks
    }
}
