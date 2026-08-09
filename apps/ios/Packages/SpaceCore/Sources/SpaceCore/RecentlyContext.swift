import Foundation

public struct RecentlyContext: Sendable, Equatable, Identifiable {
    public enum Kind: String, CaseIterable, Sendable, Equatable {
        case post
        case note
        case page
        case recently
    }

    public let id: String
    public let kind: Kind
    public let title: String

    public init(id: String, kind: Kind, title: String) {
        self.id = id
        self.kind = kind
        self.title = title
    }

    init(_ candidate: Components.Schemas.RecentlyRefCandidate) {
        id = candidate.id
        kind = Kind(rawValue: candidate._type.rawValue) ?? .recently
        title = candidate.title ?? "Untitled \(candidate._type.rawValue.capitalized)"
    }

    init(_ ref: Components.Schemas.RecentlyCard.RefPayload) {
        id = ref.id
        kind = Kind(rawValue: ref._type.rawValue) ?? .recently
        title = ref.title ?? "Untitled \(ref._type.rawValue.capitalized)"
    }
}

extension RecentlyCard {
    public var context: RecentlyContext? {
        ref.map(RecentlyContext.init)
    }
}
