import SpaceCore
import SpaceUI
import SwiftUI

struct CommentRowView: View {
    let comment: Components.Schemas.CommentRow

    private var isUnread: Bool {
        CommentState(rawValue: comment.state) == .unread
    }

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.regular) {
            Circle()
                .fill(isUnread ? Color.accentColor : Color.clear)
                .frame(width: 7, height: 7)
                .padding(.top, 7)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: Spacing.tight) {
                HStack {
                    Text(comment.author ?? "Visitor")
                        .font(.subheadline.weight(.semibold))
                    Spacer()
                    Text(comment.createdAt, format: .relative(presentation: .named))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Text(comment.text)
                    .font(.body)
                    .lineLimit(2)
                HStack(spacing: Spacing.tight) {
                    Label(comment.refType.capitalized, systemImage: "doc.text")
                    if let code = comment.countryCode {
                        Text(code.uppercased())
                    }
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, Spacing.tight)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            "\(isUnread ? "Unread" : "Read"), "
                + "\(comment.author ?? "Visitor"), \(comment.text)"
        )
    }
}
