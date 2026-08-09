import SpaceCore
import SpaceUI
import SwiftUI

struct CommentDetailView: View {
    @State var store: CommentDetailStore
    @State private var reply = ""
    @State private var confirmDelete = false
    @State private var detailsExpanded = false

    let openWeb: () -> Void
    let onDelete: () -> Void
    let onMutation: () -> Void

    var body: some View {
        Group {
            switch store.state {
            case .loading:
                ProgressView()
            case let .failed(message):
                ContentUnavailableView {
                    Label("Comment unavailable", systemImage: "exclamationmark.bubble")
                } description: {
                    Text(message)
                } actions: {
                    Button("Retry") {
                        Task { if await store.load() { onMutation() } }
                    }
                    .buttonStyle(.glassProminent)
                }
            case let .loaded(comment):
                content(comment)
            }
        }
        .background(Color(SpacePalette.page))
        .navigationTitle("Comment")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { detailMenu }
        .task {
            if await store.load() { onMutation() }
        }
        .confirmationDialog(
            "Delete this comment?",
            isPresented: $confirmDelete,
            titleVisibility: .visible
        ) {
            Button("Delete", role: .destructive) {
                Task { if await store.delete() { onDelete() } }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This action cannot be undone.")
        }
    }

    private func content(_ comment: Components.Schemas.CommentDetail) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.large) {
                authorHeader(comment)

                Text(comment.text)
                    .font(.body)
                    .foregroundStyle(Color(SpacePalette.primary))
                    .lineSpacing(4)
                    .fixedSize(horizontal: false, vertical: true)
                    .textSelection(.enabled)

                if let parent = comment.parent {
                    ParentQuote(author: parent.author, text: parent.text, isDeleted: parent.isDeleted)
                }

                if let ref = comment.ref {
                    referencedContent(ref)
                }

                Divider()

                DisclosureGroup("Details", isExpanded: $detailsExpanded) {
                    VStack(spacing: 0) {
                        detailRow("Email", value: comment.mail)
                        detailRow("IP address", value: comment.ip)
                        detailRow("User agent", value: comment.agent)
                        detailRow("Auth provider", value: comment.authProvider)
                        detailRow("Replies", value: comment.replyCount.map(String.init))
                    }
                    .padding(.top, Spacing.small)
                }
                .font(.subheadline)
            }
            .padding(.horizontal, Spacing.regular)
            .padding(.top, Spacing.medium)
            .padding(.bottom, Spacing.section)
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            replyBar(comment)
        }
    }

    private func authorHeader(_ comment: Components.Schemas.CommentDetail) -> some View {
        HStack(alignment: .top, spacing: Spacing.medium) {
            avatar(comment.avatar, author: comment.author)

            VStack(alignment: .leading, spacing: Spacing.xSmall) {
                Text(comment.author ?? "Visitor")
                    .font(.headline)
                    .foregroundStyle(Color(SpacePalette.primary))

                HStack(spacing: Spacing.small) {
                    Text(comment.createdAt, format: .relative(presentation: .named))
                    if let location = comment.location ?? comment.countryCode, !location.isEmpty {
                        Text("·")
                        Text(location)
                    }
                }
                .font(.caption)
                .foregroundStyle(Color(SpacePalette.muted))

                HStack(spacing: Spacing.small) {
                    StatusPill(state: comment.state)
                    if comment.isWhispers == true {
                        Label("Whisper", systemImage: "eye.slash.fill")
                            .font(.caption2.weight(.medium))
                            .foregroundStyle(Color(SpacePalette.info))
                            .padding(.horizontal, Spacing.small)
                            .padding(.vertical, Spacing.xSmall)
                            .background(Color(SpacePalette.info).opacity(0.1), in: .capsule)
                    }
                }
                .padding(.top, Spacing.xSmall)
            }
            Spacer(minLength: 0)
        }
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private func avatar(_ rawURL: String?, author: String?) -> some View {
        let fallback = String((author ?? "V").prefix(1)).uppercased()
        if let rawURL, let url = URL(string: rawURL) {
            AsyncImage(url: url) { image in
                image.resizable().scaledToFill()
            } placeholder: {
                avatarFallback(fallback)
            }
            .frame(width: 44, height: 44)
            .clipShape(.circle)
        } else {
            avatarFallback(fallback)
                .frame(width: 44, height: 44)
        }
    }

    private func avatarFallback(_ initial: String) -> some View {
        ZStack {
            Circle().fill(Color(SpacePalette.inset))
            Text(initial)
                .font(.headline)
                .foregroundStyle(Color(SpacePalette.muted))
        }
    }

    private func referencedContent(
        _ ref: Components.Schemas.CommentDetail.RefPayload
    ) -> some View {
        Button(action: openWeb) {
            HStack(spacing: Spacing.medium) {
                Image(systemName: refIcon(ref._type))
                    .foregroundStyle(Color(SpacePalette.accent))
                    .frame(width: 24)
                VStack(alignment: .leading, spacing: Spacing.xSmall) {
                    Text(ref._type.capitalized)
                        .font(.caption)
                        .foregroundStyle(Color(SpacePalette.subtle))
                    Text(ref.title ?? "Untitled content")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Color(SpacePalette.primary))
                        .lineLimit(2)
                }
                Spacer(minLength: 0)
                Image(systemName: "safari")
                    .foregroundStyle(Color(SpacePalette.muted))
            }
            .padding(Spacing.medium)
            .background(Color(SpacePalette.inset), in: .rect(cornerRadius: Radius.control))
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private func detailRow(_ title: String, value: String?) -> some View {
        if let value, !value.isEmpty {
            LabeledContent(title) {
                Text(value)
                    .foregroundStyle(Color(SpacePalette.muted))
                    .multilineTextAlignment(.trailing)
                    .textSelection(.enabled)
            }
            .padding(.vertical, Spacing.small)
            Divider()
        }
    }

    private func replyBar(_ comment: Components.Schemas.CommentDetail) -> some View {
        VStack(alignment: .leading, spacing: Spacing.small) {
            if let error = store.errorMessage {
                Label(error, systemImage: "exclamationmark.triangle")
                    .font(.caption)
                    .foregroundStyle(Color(SpacePalette.danger))
            }

            if CommentState(rawValue: comment.state) == .junk {
                Button("Restore and reply", systemImage: "tray.and.arrow.up") {
                    Task {
                        if await store.restore() { onMutation() }
                    }
                }
                .buttonStyle(.glassProminent)
                .frame(maxWidth: .infinity)
            } else {
                HStack(alignment: .bottom, spacing: Spacing.small) {
                    TextField("Reply as owner", text: $reply, axis: .vertical)
                        .lineLimit(1 ... 5)
                        .composerFieldSurface()
                        .accessibilityIdentifier("comments.reply")

                    if store.isSending {
                        ProgressView()
                            .frame(width: 44, height: 44)
                    } else {
                        Button("Send", systemImage: "arrow.up") {
                            let text = reply.trimmingCharacters(in: .whitespacesAndNewlines)
                            Task {
                                if await store.reply(text) {
                                    reply = ""
                                    onMutation()
                                }
                            }
                        }
                        .labelStyle(.iconOnly)
                        .font(.body.weight(.semibold))
                        .buttonStyle(.glassProminent)
                        .disabled(trimmedReply.isEmpty)
                        .frame(width: 44, height: 44)
                        .accessibilityIdentifier("comments.send")
                    }
                }
            }
        }
        .padding(.horizontal, Spacing.regular)
        .padding(.top, Spacing.small)
        .padding(.bottom, Spacing.medium)
    }

    @ToolbarContentBuilder
    private var detailMenu: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Menu("Comment actions", systemImage: "ellipsis.circle") {
                Button("Open on Web", systemImage: "safari", action: openWeb)

                if store.commentState == .junk {
                    Button("Restore", systemImage: "tray.and.arrow.up") {
                        Task {
                            if await store.restore() { onMutation() }
                        }
                    }
                } else {
                    if store.commentState == .unread {
                        Button("Mark as Read", systemImage: "envelope.open") {
                            Task {
                                if await store.markRead(true) { onMutation() }
                            }
                        }
                    } else {
                        Button("Mark as Unread", systemImage: "envelope.badge") {
                            Task {
                                if await store.markRead(false) { onMutation() }
                            }
                        }
                    }

                    Button("Move to Junk", systemImage: "exclamationmark.bin") {
                        Task {
                            if await store.markJunk() { onMutation() }
                        }
                    }
                }

                Divider()

                Button("Delete", systemImage: "trash", role: .destructive) {
                    confirmDelete = true
                }
            }
            .labelStyle(.iconOnly)
        }
    }

    private var trimmedReply: String {
        reply.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func refIcon(_ type: String) -> String {
        switch type.lowercased() {
        case "post": "doc.text"
        case "note": "note.text"
        case "page": "doc"
        case "recently": "text.bubble"
        default: "doc.text"
        }
    }
}

private struct ParentQuote: View {
    let author: String?
    let text: String
    let isDeleted: Bool

    var body: some View {
        HStack(alignment: .top, spacing: Spacing.medium) {
            RoundedRectangle(cornerRadius: 1)
                .fill(Color(SpacePalette.subtle).opacity(0.45))
                .frame(width: 3)
            VStack(alignment: .leading, spacing: Spacing.xSmall) {
                Text(author ?? "Previous comment")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color(SpacePalette.muted))
                Text(isDeleted ? "This comment was deleted." : text)
                    .font(.subheadline)
                    .foregroundStyle(Color(SpacePalette.muted))
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

private struct StatusPill: View {
    let state: Int

    var body: some View {
        Text(title)
            .font(.caption2.weight(.medium))
            .foregroundStyle(color)
            .padding(.horizontal, Spacing.small)
            .padding(.vertical, Spacing.xSmall)
            .background(color.opacity(0.1), in: .capsule)
    }

    private var title: String {
        switch CommentState(rawValue: state) {
        case .unread: "Unread"
        case .junk: "Junk"
        default: "Read"
        }
    }

    private var color: Color {
        switch CommentState(rawValue: state) {
        case .unread: Color(SpacePalette.accent)
        case .junk: Color(SpacePalette.danger)
        default: Color(SpacePalette.muted)
        }
    }
}
