import Foundation

/// Presentation-ready projection of an `EnrichmentResult`.
///
/// The generated client models `thumbnail_image`, `preview_image` and
/// `capture_image` as three unrelated nested types, and `attribute.value` as a
/// three-optional anyOf box. Flattening that here keeps the shape churn of code
/// generation out of the views.
///
/// Variant selection mirrors Yohaku's `LinkCardVariant` dispatch so an entry
/// reads the same on both surfaces.
public struct MediaCard: Sendable, Equatable, Identifiable {
    public enum PosterKind: Sendable, Equatable {
        case movie
        case book
        case album

        /// Drives poster *width*; height comes from the card.
        public var aspectRatio: Double {
            switch self {
            case .movie: 2.0 / 3.0
            case .book: 5.0 / 7.0
            case .album: 1
            }
        }
    }

    public enum Variant: Sendable, Equatable {
        case poster(PosterKind)
        case fallback
    }

    public struct Attribute: Sendable, Equatable {
        public let key: String
        public let label: String?
        public let value: String
    }

    public let id: String
    public let title: String
    /// Chosen per variant: plot for a movie, artist for music, author for a book.
    public let subtitle: String?
    public let description: String?
    public let category: String
    public let subtype: String?
    public let variant: Variant
    public let url: URL?
    public let host: String?
    public let artworkURL: URL?
    public let accentHex: String?
    public let year: String?
    public let attributes: [Attribute]

    /// Eyebrow caps above the title, e.g. `MOVIE · 2024`.
    public var topCaps: String? {
        guard case let .poster(kind) = variant else { return nil }
        let name = switch kind {
        case .movie: subtype?.uppercased() ?? "MOVIE"
        case .book: "BOOK"
        case .album: subtype?.uppercased() ?? "ALBUM"
        }
        guard let year else { return name }
        return "\(name) · \(year)"
    }

    /// Compact meta line under the title — host plus the few attributes worth
    /// surfacing, matching `MetaRow` on the web.
    public var metaLine: String {
        var parts: [String] = []
        if let rating = attribute("rating") { parts.append("★ \(rating)") }
        for key in ["artist", "author", "genres", "albumName", "album"] {
            if let value = attribute(key), !parts.contains(value) {
                parts.append(value)
            }
        }
        if let host { parts.append(host) }
        return parts.prefix(3).joined(separator: " · ")
    }

    public func attribute(_ key: String) -> String? {
        attributes.first { $0.key == key }?.value
    }

    public init(_ result: EnrichmentResult) {
        let artwork = MediaCard.artwork(result)
        let attributes = (result.attributes ?? []).compactMap(MediaCard.attribute)

        id = result.id ?? result.url
        title = result.title
        description = result.description
        category = result.category
        subtype = result.subtype
        variant = MediaCard.variant(category: result.category, subtype: result.subtype)
        url = URL(string: result.url)
        host = URL(string: result.url)?.host()
        artworkURL = artwork.url.flatMap(URL.init(string:))
        accentHex = result.color ?? artwork.dominant
        year = result.publishedAt.flatMap { String($0.prefix(4)) }
        self.attributes = attributes
        subtitle = MediaCard.subtitle(
            variant: variant,
            subtype: result.subtype,
            description: result.description,
            attributes: attributes
        )
    }

    static func variant(category: String, subtype: String?) -> Variant {
        let subtype = subtype ?? ""
        if category == "media" {
            switch subtype {
            case "movie", "tv": return .poster(.movie)
            case "book": return .poster(.book)
            case "music", "album", "song": return .poster(.album)
            default: break
            }
            // Bangumi subjects arrive without a subtype we recognise; they are
            // still poster-shaped artwork, so keep them out of the OG card.
            return .poster(.movie)
        }
        if category == "book" { return .poster(.book) }
        if category == "music" { return .poster(.album) }
        return .fallback
    }

    private static func subtitle(
        variant: Variant,
        subtype: String?,
        description: String?,
        attributes: [Attribute]
    ) -> String? {
        func value(_ key: String) -> String? {
            attributes.first { $0.key == key }?.value
        }
        guard case let .poster(kind) = variant else { return description }
        return switch kind {
        case .movie: description
        case .album: value("artist") ?? description
        case .book: value("author") ?? description
        }
    }

    private static func artwork(
        _ result: EnrichmentResult
    ) -> (url: String?, dominant: String?) {
        if let image = result.thumbnailImage {
            return (image.url, image.palette?.dominant)
        }
        if let image = result.previewImage {
            return (image.url, image.palette?.dominant)
        }
        if let image = result.captureImage {
            return (image.url, image.palette?.dominant)
        }
        return (nil, nil)
    }

    private static func attribute(
        _ raw: Components.Schemas.EnrichmentResult.AttributesPayloadPayload
    ) -> Attribute? {
        let value = raw.value
        let rendered: String? =
            if let text = value.value1 {
                text
            } else if let number = value.value2 {
                number == number.rounded() ? String(Int(number)) : String(number)
            } else if let flag = value.value3 {
                flag ? "yes" : "no"
            } else {
                nil
            }
        guard let rendered else { return nil }
        return Attribute(key: raw.key, label: raw.label, value: rendered)
    }
}
