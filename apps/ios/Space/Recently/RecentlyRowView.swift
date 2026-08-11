import SpaceCore
import SpaceUI
import SwiftUI

struct RecentlyRowView: View {
    let entry: RecentlyCard
    let onEdit: () -> Void
    let onDelete: () -> Void
    var openCardURL: ((URL) -> Void)? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.regular) {
            if let context = entry.context {
                RecentlyContextCardView(context: context)
            }

            body(for: entry.blocks)
            footer
        }
        .padding(.vertical, Spacing.large)
        .accessibilityElement(children: .contain)
    }

    @ViewBuilder
    private func body(for blocks: [RecentlyBlock]) -> some View {
        VStack(alignment: .leading, spacing: Spacing.regular) {
            ForEach(blocks) { block in
                switch block {
                case let .text(text):
                    Text(text)
                        .font(.body)
                        .foregroundStyle(Color(SpacePalette.primary))
                        .lineSpacing(4)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .textSelection(.enabled)
                case let .card(card):
                    EnrichmentCardView(
                        card: card,
                        accessibilityIdentifier: "recently.enrichment.\(entry.id)",
                        openURL: openCardURL
                    )
                }
            }
        }
    }

    private var footer: some View {
        HStack(spacing: Spacing.medium) {
            Text(entry.createdAt, format: .relative(presentation: .named))
                .monospacedDigit()
            if entry.modifiedAt != nil {
                Text("Edited")
                    .foregroundStyle(Color(SpacePalette.subtle))
            }

            Spacer(minLength: Spacing.small)

            if let up = entry.up, up > 0 {
                Label("\(up)", systemImage: "hand.thumbsup")
            }
            if let down = entry.down, down > 0 {
                Label("\(down)", systemImage: "hand.thumbsdown")
            }
            if let comments = entry.commentsIndex, comments > 0 {
                Label("\(comments)", systemImage: "bubble.left")
            }

            Menu("Recently actions", systemImage: "ellipsis") {
                Button("Edit", systemImage: "pencil", action: onEdit)
                Button("Delete", systemImage: "trash", role: .destructive, action: onDelete)
            }
            .labelStyle(.iconOnly)
            .accessibilityIdentifier("recently.actions")
        }
        .font(.caption)
        .foregroundStyle(Color(SpacePalette.muted))
    }
}
