import SpaceCore
import SpaceUI
import SwiftUI

struct RecentlyComposerView: View {
    @Environment(\.dismiss) private var dismiss
    @FocusState private var isEditorFocused: Bool

    let service: RecentlyService
    let navigationTitle: String
    private let confirmationTitle: String
    private let initialText: String
    private let onDirtyChange: ((Bool) -> Void)?
    /// Returns nil on success, or a message to show in place.
    let onSave: (String) async -> String?

    @State private var text: String
    @State private var preview: MediaCard?
    @State private var previewedURL: String?
    @State private var isResolving = false
    @State private var isPosting = false
    @State private var postFailure: String?
    @State private var confirmDiscard = false
    @State private var previewTask: Task<Void, Never>?

    init(
        service: RecentlyService,
        initialText: String = "",
        navigationTitle: String = "New Recently",
        onDirtyChange: ((Bool) -> Void)? = nil,
        onSave: @escaping (String) async -> String?
    ) {
        self.service = service
        self.navigationTitle = navigationTitle
        self.confirmationTitle = initialText.isEmpty ? "Publish" : "Save"
        self.initialText = initialText
        self.onDirtyChange = onDirtyChange
        self.onSave = onSave
        _text = State(initialValue: initialText)
    }

    private var isDirty: Bool {
        text != initialText
    }

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: Spacing.regular) {
                TextEditor(text: $text)
                    .focused($isEditorFocused)
                    .frame(minHeight: 140)
                    .scrollContentBackground(.hidden)
                    .padding(Spacing.tight)
                    .background(
                        RoundedRectangle(cornerRadius: Radius.control, style: .continuous)
                            .fill(Color(.secondarySystemBackground))
                    )
                    .accessibilityIdentifier("recently.composer.text")

                previewSection

                if let postFailure {
                    Label(postFailure, systemImage: "exclamationmark.triangle")
                        .font(.caption)
                        .foregroundStyle(.red)
                        .accessibilityIdentifier("recently.composer.error")
                }

                Spacer()
            }
            .padding(Spacing.regular)
            .navigationTitle(navigationTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        if isDirty {
                            confirmDiscard = true
                        } else {
                            dismiss()
                        }
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(confirmationTitle, action: post)
                        .disabled(trimmed.isEmpty || isPosting)
                        .accessibilityIdentifier("recently.composer.post")
                }
            }
            .confirmationDialog(
                "Discard this draft?",
                isPresented: $confirmDiscard,
                titleVisibility: .visible
            ) {
                Button("Discard Draft", role: .destructive) { dismiss() }
                Button("Keep Editing", role: .cancel) {}
            }
            .onChange(of: text) { _, newValue in
                onDirtyChange?(newValue != initialText)
                schedulePreview(for: newValue)
            }
            .onDisappear { previewTask?.cancel() }
            .task { isEditorFocused = true }
        }
    }

    @ViewBuilder
    private var previewSection: some View {
        if isResolving {
            HStack(spacing: Spacing.tight) {
                ProgressView()
                Text("Resolving link…").font(.caption).foregroundStyle(.secondary)
            }
        } else if let preview {
            VStack(alignment: .leading, spacing: Spacing.tight) {
                EnrichmentCardView(card: preview)
                if needsIsolation { isolationHint }
            }
        }
    }

    /// The server only cardifies a link that owns its whole paragraph, so a
    /// resolvable link sitting mid-sentence previews here but would post as
    /// plain text. Offer the one-tap rewrite rather than a passive warning.
    private var needsIsolation: Bool {
        guard let previewedURL else { return false }
        return !RecentlyService.cardableURLs(in: text).contains(previewedURL)
    }

    private var isolationHint: some View {
        HStack(alignment: .top, spacing: Spacing.tight) {
            Image(systemName: "info.circle")
            Text("Posts as plain text unless the link sits on its own line.")
            Spacer(minLength: 0)
            Button("Fix") {
                guard let previewedURL else { return }
                text = RecentlyService.isolatingLink(previewedURL, in: text)
            }
            .buttonStyle(.borderless)
            .accessibilityIdentifier("recently.composer.isolateLink")
        }
        .font(.caption)
        .foregroundStyle(.secondary)
    }

    private var trimmed: String {
        text.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Debounced so a URL typed character by character resolves once, not once
    /// per keystroke — the resolve endpoint is rate limited.
    private func schedulePreview(for value: String) {
        previewTask?.cancel()
        guard let url = RecentlyService.firstDetectedURL(in: value) else {
            preview = nil
            previewedURL = nil
            isResolving = false
            return
        }
        if url == previewedURL, preview != nil { return }

        previewTask = Task {
            try? await Task.sleep(for: .milliseconds(600))
            guard !Task.isCancelled else { return }
            isResolving = true
            defer { isResolving = false }
            preview = (try? await service.resolve(url: url)).flatMap { $0 }.map(MediaCard.init)
            previewedURL = preview == nil ? nil : url
        }
    }

    private func post() {
        isPosting = true
        postFailure = nil
        Task {
            defer { isPosting = false }
            if let failure = await onSave(trimmed) {
                postFailure = failure
            } else {
                dismiss()
            }
        }
    }
}
