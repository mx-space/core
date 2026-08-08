import SpaceCore
import SpaceUI
import SwiftUI

struct CommentDetailView: View {
    @State var store: CommentDetailStore
    @State private var reply = ""
    @State private var confirmDelete = false

    let openWeb: () -> Void
    let onDelete: () -> Void
    let onMutation: () -> Void

    var body: some View {
        Group {
            switch store.state {
            case .loading:
                ProgressView()
            case let .failed(message):
                ContentUnavailableView(
                    "Comment unavailable",
                    systemImage: "exclamationmark.bubble",
                    description: Text(message)
                )
            case let .loaded(comment):
                content(comment)
            }
        }
        .navigationTitle("Comment")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { detailMenu }
        .task { await store.load() }
        .confirmationDialog(
            "Delete this comment?",
            isPresented: $confirmDelete,
            titleVisibility: .visible
        ) {
            Button("Delete", role: .destructive) {
                Task { if await store.delete() { onDelete() } }
            }
        }
    }

    private func content(_ comment: Components.Schemas.CommentDetail) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.loose) {
                VStack(alignment: .leading, spacing: Spacing.tight) {
                    HStack(alignment: .firstTextBaseline) {
                        Text(comment.author ?? "Visitor")
                            .font(.title3.weight(.semibold))
                        Spacer()
                        Text(comment.createdAt, format: .relative(presentation: .named))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Text(statusTitle(comment.state))
                        .font(.caption.weight(.medium))
                        .foregroundStyle(statusColor(comment.state))
                        .padding(.horizontal, Spacing.tight)
                        .padding(.vertical, Spacing.hairline)
                        .background(
                            statusColor(comment.state).opacity(0.12),
                            in: .capsule
                        )
                    Text(comment.text)
                        .font(.body)
                        .padding(.top, Spacing.tight)
                        .textSelection(.enabled)
                }
                .padding(Spacing.regular)
                .background(Color(.secondarySystemBackground), in: .rect(cornerRadius: Radius.card))

                if let parent = comment.parent {
                    VStack(alignment: .leading, spacing: Spacing.tight) {
                        Text("In reply to").font(.headline)
                        Text(parent.text)
                            .foregroundStyle(.secondary)
                    }
                    .padding(Spacing.regular)
                    .background(Color(.secondarySystemBackground), in: .rect(cornerRadius: Radius.control))
                }

                if let ref = comment.ref {
                    Button(action: openWeb) {
                        HStack(spacing: Spacing.regular) {
                            Image(systemName: "doc.text")
                                .foregroundStyle(.tint)
                            VStack(alignment: .leading, spacing: Spacing.hairline) {
                                Text("Referenced content")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                Text(ref.title ?? ref._type.capitalized)
                                    .font(.subheadline.weight(.medium))
                                    .lineLimit(2)
                            }
                            Spacer()
                            Image(systemName: "safari").foregroundStyle(.secondary)
                        }
                        .contentShape(.rect)
                    }
                    .buttonStyle(.plain)
                    .padding(Spacing.regular)
                    .background(Color(.secondarySystemBackground), in: .rect(cornerRadius: Radius.control))
                }

            }
            .padding(Spacing.regular)
        }
        .safeAreaInset(edge: .bottom) {
            VStack(alignment: .leading, spacing: Spacing.tight) {
                if let error = store.errorMessage {
                    Label(error, systemImage: "exclamationmark.triangle")
                        .font(.caption)
                        .foregroundStyle(.red)
                }
                HStack(alignment: .bottom, spacing: Spacing.tight) {
                    TextField("Reply as owner", text: $reply, axis: .vertical)
                        .lineLimit(1...5)
                        .textFieldStyle(.roundedBorder)
                        .accessibilityIdentifier("comments.reply")
                    if store.isSending {
                        ProgressView()
                            .frame(width: 28, height: 28)
                    } else {
                        Button("Send", systemImage: "arrow.up.circle.fill") {
                            let text = reply.trimmingCharacters(in: .whitespacesAndNewlines)
                            Task { if await store.reply(text) { reply = "" } }
                        }
                        .labelStyle(.iconOnly)
                        .font(.title2)
                        .disabled(reply.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                        .accessibilityIdentifier("comments.send")
                    }
                }
            }
            .padding(Spacing.regular)
            .background(.bar)
        }
    }

    @ToolbarContentBuilder
    private var detailMenu: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Menu("Comment actions", systemImage: "ellipsis.circle") {
                Button("Open on Web", systemImage: "safari", action: openWeb)
                if store.commentState == .unread {
                    Button("Mark as Read", systemImage: "envelope.open") {
                        Task {
                            if await store.markRead(true) { onMutation() }
                        }
                    }
                } else if store.commentState != .junk {
                    Button("Mark as Unread", systemImage: "envelope.badge") {
                        Task {
                            if await store.markRead(false) { onMutation() }
                        }
                    }
                }
                Button("Move to Junk", systemImage: "exclamationmark.bin") {
                    Task { if await store.markJunk() { onDelete() } }
                }
                Button("Delete", systemImage: "trash", role: .destructive) {
                    confirmDelete = true
                }
            }
            .labelStyle(.iconOnly)
        }
    }

    private func statusTitle(_ state: Int) -> String {
        switch CommentState(rawValue: state) {
        case .unread: "Unread"
        case .junk: "Junk"
        default: "Read"
        }
    }

    private func statusColor(_ state: Int) -> Color {
        switch CommentState(rawValue: state) {
        case .unread: .accentColor
        case .junk: .red
        default: .secondary
        }
    }
}
