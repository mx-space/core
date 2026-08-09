import SpaceCore
import SpaceUI
import SwiftUI

struct CommentRowView: View {
    let comment: Components.Schemas.CommentRow

    private var isUnread: Bool {
        CommentState(rawValue: comment.state) == .unread
    }

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.medium) {
            Circle()
                .fill(isUnread ? Color(SpacePalette.accent) : Color.clear)
                .frame(width: 7, height: 7)
                .padding(.top, 7)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: Spacing.small) {
                HStack(alignment: .firstTextBaseline, spacing: Spacing.small) {
                    Text(comment.author ?? "Visitor")
                        .font(.subheadline.weight(isUnread ? .semibold : .medium))
                        .foregroundStyle(Color(SpacePalette.primary))
                        .lineLimit(1)
                    Spacer(minLength: Spacing.small)
                    Text(comment.createdAt, format: .relative(presentation: .named))
                        .font(.caption)
                        .foregroundStyle(Color(SpacePalette.subtle))
                        .monospacedDigit()
                }

                Text(comment.text)
                    .font(.body)
                    .foregroundStyle(Color(SpacePalette.primary))
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)

                HStack(spacing: Spacing.medium) {
                    Label(comment.refType.capitalized, systemImage: refIcon)
                    if let code = comment.countryCode, !code.isEmpty {
                        Text(code.uppercased())
                    }
                }
                .font(.caption)
                .foregroundStyle(Color(SpacePalette.muted))
            }
        }
        .padding(.vertical, Spacing.medium)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            "\(isUnread ? "Unread" : "Read"), "
                + "\(comment.author ?? "Visitor"), \(comment.text)"
        )
    }

    private var refIcon: String {
        switch comment.refType.lowercased() {
        case "post": "doc.text"
        case "note": "note.text"
        case "page": "doc"
        case "recently": "text.bubble"
        default: "doc.text"
        }
    }
}
