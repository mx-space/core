import SpaceCore
import SpaceUI
import SwiftUI

struct RecentlyContextCardView: View {
    let context: RecentlyContext
    var onRemove: (() -> Void)?

    var body: some View {
        HStack(spacing: Spacing.small) {
            Image(systemName: context.kind.systemImage)
                .font(.subheadline)
                .foregroundStyle(Color(SpacePalette.accent))
                .frame(width: 22)
            VStack(alignment: .leading, spacing: 1) {
                Text(context.kind.title)
                    .font(.caption2)
                    .foregroundStyle(Color(SpacePalette.subtle))
                Text(context.title)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(Color(SpacePalette.primary))
                    .lineLimit(1)
            }
            Spacer(minLength: Spacing.small)
            if let onRemove {
                Button("Remove context", systemImage: "xmark.circle.fill", action: onRemove)
                    .labelStyle(.iconOnly)
                    .buttonStyle(.plain)
                    .tint(Color(SpacePalette.subtle))
                    .frame(width: 44, height: 44)
                    .contentShape(.rect)
            }
        }
        .padding(.horizontal, Spacing.medium)
        .frame(minHeight: 44)
        .background(Color(SpacePalette.inset), in: .rect(cornerRadius: Radius.control))
        .overlay {
            RoundedRectangle(cornerRadius: Radius.control, style: .continuous)
                .stroke(Color(.separator).opacity(0.4), lineWidth: 0.5)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(context.kind.title) context, \(context.title)")
    }
}

extension RecentlyContext.Kind {
    var title: String {
        switch self {
        case .post: "Post"
        case .note: "Note"
        case .page: "Page"
        case .recently: "Recently"
        }
    }

    var systemImage: String {
        switch self {
        case .post: "doc.text"
        case .note: "note.text"
        case .page: "doc"
        case .recently: "text.bubble"
        }
    }
}
