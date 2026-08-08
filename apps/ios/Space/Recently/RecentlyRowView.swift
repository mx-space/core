import SpaceCore
import SpaceUI
import SwiftUI

/// Layout follows Yohaku's `ThinkingItem`: a timestamp header, the body with
/// media cards sitting where their link was, then a dashed rule above the
/// reaction counts.
struct RecentlyRowView: View {
    let entry: RecentlyCard

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.regular) {
            header
            body(for: entry.blocks)
            // Without any reaction the rule would hang under the entry with
            // nothing beneath it, so the whole footer goes away.
            if hasReactions { footer }
        }
        .padding(Spacing.regular)
        .background(.background, in: .rect(cornerRadius: Radius.card))
        .accessibilityElement(children: .contain)
    }

    private var hasReactions: Bool {
        (entry.up ?? 0) > 0 || (entry.down ?? 0) > 0 || (entry.commentsIndex ?? 0) > 0
    }

    private var header: some View {
        HStack(spacing: Spacing.tight) {
            Text(entry.createdAt, format: .relative(presentation: .named))
            if entry.modifiedAt != nil {
                Text("edited")
                    .foregroundStyle(.tertiary)
            }
            Spacer()
            Image(systemName: "pencil")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.tertiary)
                .accessibilityHidden(true)
        }
        .font(.caption)
        .foregroundStyle(.secondary)
    }

    @ViewBuilder
    private func body(for blocks: [RecentlyBlock]) -> some View {
        VStack(alignment: .leading, spacing: Spacing.regular) {
            ForEach(blocks) { block in
                switch block {
                case let .text(text):
                    Text(text)
                        .font(.body)
                        .lineSpacing(4)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                case let .card(card):
                    EnrichmentCardView(card: card)
                }
            }
        }
    }

    private var footer: some View {
        HStack(spacing: Spacing.loose) {
            if let up = entry.up, up > 0 {
                Label("\(up)", systemImage: "heart")
            }
            if let down = entry.down, down > 0 {
                Label("\(down)", systemImage: "hand.thumbsdown")
            }
            if let comments = entry.commentsIndex, comments > 0 {
                Label("\(comments)", systemImage: "bubble.left")
            }
        }
        .font(.caption)
        .foregroundStyle(.secondary)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, Spacing.tight)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(Color(.separator))
                .frame(height: 0.5)
        }
    }
}
