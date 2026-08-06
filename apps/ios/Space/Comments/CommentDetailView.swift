import SpaceCore
import SpaceUI
import SwiftUI

struct CommentDetailView: View {
    @State var store: CommentDetailStore
    @State private var reply = ""
    @State private var confirmDelete = false

    let openWeb: () -> Void
    let onDelete: () -> Void

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
                    Text(comment.author ?? "Visitor")
                        .font(.title3.weight(.semibold))
                    Text(comment.createdAt, format: .relative(presentation: .named))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(comment.text)
                        .font(.body)
                        .padding(.top, Spacing.tight)
                }

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
                        HStack {
                            Label(ref.title ?? ref._type.capitalized, systemImage: "doc.text")
                            Spacer()
                            Image(systemName: "safari")
                        }
                        .contentShape(.rect)
                    }
                    .buttonStyle(.plain)
                    .padding(Spacing.regular)
                    .background(Color(.secondarySystemBackground), in: .rect(cornerRadius: Radius.control))
                }

                if let error = store.errorMessage {
                    Label(error, systemImage: "exclamationmark.triangle")
                        .font(.caption)
                        .foregroundStyle(.red)
                }
            }
            .padding(Spacing.regular)
        }
        .safeAreaInset(edge: .bottom) {
            HStack(alignment: .bottom, spacing: Spacing.tight) {
                TextField("Reply as owner", text: $reply, axis: .vertical)
                    .lineLimit(1...5)
                    .textFieldStyle(.roundedBorder)
                    .accessibilityIdentifier("comments.reply")
                Button("Send", systemImage: "arrow.up.circle.fill") {
                    let text = reply.trimmingCharacters(in: .whitespacesAndNewlines)
                    Task { if await store.reply(text) { reply = "" } }
                }
                .labelStyle(.iconOnly)
                .font(.title2)
                .disabled(reply.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || store.isSending)
                .accessibilityIdentifier("comments.send")
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
}
