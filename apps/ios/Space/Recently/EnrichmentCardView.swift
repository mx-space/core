import SpaceCore
import SpaceUI
import SwiftUI

/// Mirrors Yohaku's `LinkCardVariant`: poster-shaped media get an edge-to-edge
/// artwork card, everything else falls back to an Open Graph style card.
struct EnrichmentCardView: View {
    let card: MediaCard

    var body: some View {
        Group {
            switch card.variant {
            case let .poster(kind):
                PosterEnrichmentCard(card: card, kind: kind)
            case .fallback:
                FallbackEnrichmentCard(card: card)
            }
        }
        // One element rather than several fragments: VoiceOver reads the card
        // as a unit, and the identifier lands on a single node.
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("recently.enrichment")
    }
}

private struct PosterEnrichmentCard: View {
    let card: MediaCard
    let kind: MediaCard.PosterKind

    /// Pinned so a wider poster cannot narrow the copy column, wrap the text to
    /// more lines, and grow the card that sizes the poster — the feedback loop
    /// Yohaku's `CARD_HEIGHT` exists to break.
    private static let height: CGFloat = 112
    private static let expandThreshold = 80

    private var isExpanded: Bool {
        (card.subtitle?.count ?? 0) > Self.expandThreshold
    }

    var body: some View {
        if isExpanded {
            expandedBody
        } else {
            compactBody
        }
    }

    private var compactBody: some View {
        HStack(spacing: 0) {
            EnrichmentArtwork(url: card.artworkURL, accent: card.accent)
                .frame(width: Self.height * kind.aspectRatio)
                .frame(maxHeight: .infinity)
            copy
                .padding(.horizontal, Spacing.regular)
                .padding(.vertical, Spacing.tight)
        }
        .frame(height: Self.height)
        .modifier(CardShell(accent: card.accent))
    }

    private var expandedBody: some View {
        HStack(alignment: .top, spacing: Spacing.regular) {
            copy
            EnrichmentArtwork(url: card.artworkURL, accent: card.accent)
                .frame(width: 64, height: 64 / kind.aspectRatio)
                .clipShape(
                    RoundedRectangle(cornerRadius: Radius.control * 0.5, style: .continuous)
                )
        }
        .padding(Spacing.regular)
        .modifier(CardShell(accent: card.accent))
    }

    private var copy: some View {
        VStack(alignment: .leading, spacing: 2) {
            if let caps = card.topCaps {
                Text(caps)
                    .font(.caption2.weight(.semibold))
                    .tracking(1.2)
                    .foregroundStyle(.secondary)
            }
            Text(card.title)
                .font(.subheadline.weight(.semibold))
                .lineLimit(2)
            if let subtitle = card.subtitle {
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(isExpanded ? 4 : 1)
            }
            if !card.metaLine.isEmpty {
                Text(card.metaLine)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
                    .lineLimit(1)
                    .padding(.top, 2)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct FallbackEnrichmentCard: View {
    let card: MediaCard

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.regular) {
            VStack(alignment: .leading, spacing: Spacing.hairline) {
                Text(card.title)
                    .font(.subheadline.weight(.medium))
                    .lineLimit(2)
                if let description = card.description {
                    Text(description)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                }
                if !card.metaLine.isEmpty {
                    Text(card.metaLine)
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                        .lineLimit(1)
                        .padding(.top, 2)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            if card.artworkURL != nil {
                EnrichmentArtwork(url: card.artworkURL, accent: card.accent)
                    .frame(width: 72, height: 54)
                    .clipShape(
                        RoundedRectangle(cornerRadius: Radius.control * 0.5, style: .continuous)
                    )
            }
        }
        .padding(Spacing.regular)
        .modifier(CardShell(accent: card.accent))
    }
}

private struct EnrichmentArtwork: View {
    let url: URL?
    let accent: Color

    var body: some View {
        AsyncImage(url: url) { image in
            image.resizable().aspectRatio(contentMode: .fill)
        } placeholder: {
            Rectangle().fill(accent.opacity(0.2))
        }
        .clipped()
    }
}

/// The shared shell: rounded surface, hairline ring, and a faint wash of the
/// artwork's dominant colour.
private struct CardShell: ViewModifier {
    let accent: Color

    func body(content: Content) -> some View {
        content
            .background(
                RoundedRectangle(cornerRadius: Radius.control, style: .continuous)
                    .fill(Color(.secondarySystemBackground))
                    .overlay(
                        RoundedRectangle(cornerRadius: Radius.control, style: .continuous)
                            .fill(accent.opacity(0.10))
                    )
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.control, style: .continuous)
                    .strokeBorder(accent.opacity(0.20))
            )
            .clipShape(RoundedRectangle(cornerRadius: Radius.control, style: .continuous))
    }
}

extension MediaCard {
    var accent: Color {
        accentHex.flatMap(Color.init(hex:)) ?? Color(.tertiarySystemFill)
    }
}

extension Color {
    init?(hex: String) {
        var trimmed = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.hasPrefix("#") { trimmed.removeFirst() }
        guard trimmed.count == 6, let value = UInt32(trimmed, radix: 16) else { return nil }
        self.init(
            red: Double((value >> 16) & 0xFF) / 255,
            green: Double((value >> 8) & 0xFF) / 255,
            blue: Double(value & 0xFF) / 255
        )
    }
}
