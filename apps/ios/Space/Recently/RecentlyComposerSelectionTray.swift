import SpaceCore
import SpaceUI
import SwiftUI

struct RecentlyComposerSelectionTray: View {
    @Bindable var store: RecentlyComposerStore

    var body: some View {
        ScrollView(.horizontal) {
            LazyHStack(spacing: Spacing.small) {
                if let context = store.context {
                    contextReceipt(context)
                }

                ForEach(store.selectedLinks) { preview in
                    linkReceipt(preview)
                }
            }
        }
        .scrollIndicators(.hidden)
        .frame(height: 52)
        .accessibilityLabel("Selected attachments")
    }

    private func contextReceipt(_ context: RecentlyContext) -> some View {
        HStack(spacing: Spacing.small) {
            Image(systemName: context.kind.systemImage)
                .font(.system(size: 17, weight: .medium))
                .foregroundStyle(Color(SpacePalette.accent))
                .frame(width: 24)

            VStack(alignment: .leading, spacing: 1) {
                Text(context.title)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color(SpacePalette.primary))
                    .lineLimit(1)
                Text(context.kind.title)
                    .font(.caption2)
                    .foregroundStyle(Color(SpacePalette.subtle))
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            removeButton(label: "Remove \(context.title)") {
                store.removeContext()
            }
        }
        .padding(.leading, Spacing.medium)
        .frame(width: 220, height: 52)
        .selectionReceiptSurface()
        .accessibilityIdentifier("recently.composer.selection.context")
    }

    private func linkReceipt(_ preview: ComposerLinkPreview) -> some View {
        HStack(spacing: Spacing.small) {
            if let card = preview.card {
                ComposerArtwork(url: card.artworkURL, accent: card.accent)
                    .frame(width: 34, height: 48)
                    .clipShape(.rect(cornerRadius: 6))
            } else {
                Image(systemName: "link")
                    .font(.system(size: 17, weight: .medium))
                    .foregroundStyle(Color(SpacePalette.accent))
                    .frame(width: 34)
            }

            VStack(alignment: .leading, spacing: 1) {
                Text(preview.card?.title ?? URL(string: preview.url)?.host() ?? "Link")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color(SpacePalette.primary))
                    .lineLimit(1)
                Text(linkDetail(preview))
                    .font(.caption2)
                    .foregroundStyle(Color(SpacePalette.subtle))
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            if preview.isResolving {
                ProgressView()
                    .controlSize(.small)
                    .frame(width: 32, height: 44)
            } else {
                removeButton(label: "Remove \(preview.card?.title ?? "link")") {
                    store.toggleLink(preview.url)
                }
            }
        }
        .padding(.leading, Spacing.small)
        .frame(width: 230, height: 52)
        .selectionReceiptSurface()
        .accessibilityIdentifier("recently.composer.enrichment")
    }

    private func removeButton(label: String, action: @escaping () -> Void) -> some View {
        Button(label, systemImage: "xmark.circle.fill", action: action)
            .labelStyle(.iconOnly)
            .buttonStyle(.plain)
            .foregroundStyle(Color(SpacePalette.subtle))
            .frame(width: 40, height: 44)
            .contentShape(.rect)
    }

    private func linkDetail(_ preview: ComposerLinkPreview) -> String {
        guard let card = preview.card else {
            return preview.isResolving ? "Resolving…" : "Link attachment"
        }
        return card.topCaps ?? (card.metaLine.isEmpty ? card.category.capitalized : card.metaLine)
    }
}

struct ComposerArtwork: View {
    let url: URL?
    let accent: Color

    var body: some View {
        AsyncImage(url: url) { image in
            image.resizable().scaledToFill()
        } placeholder: {
            Rectangle().fill(accent.opacity(0.18))
        }
        .clipped()
    }
}

private extension View {
    func selectionReceiptSurface() -> some View {
        background(Color(SpacePalette.inset), in: .rect(cornerRadius: Radius.control))
            .overlay {
                RoundedRectangle(cornerRadius: Radius.control, style: .continuous)
                    .stroke(Color(.separator).opacity(0.28), lineWidth: 0.5)
            }
    }
}
