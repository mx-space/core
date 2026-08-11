import SpaceCore
import SpaceUI
import SwiftUI

struct RecentlyInlineComposerView: View {
    @Bindable var store: RecentlyComposerStore
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @FocusState private var inputFocused: Bool

    var body: some View {
        VStack(spacing: Spacing.xSmall) {
            if store.isEditing {
                editingBanner
            }

            if !store.isShowingComposerPanel {
                metadataTray

                if let error = store.errorMessage {
                    Label(error, systemImage: "exclamationmark.triangle")
                        .font(.caption)
                        .foregroundStyle(Color(SpacePalette.danger))
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .lineLimit(2)
                        .accessibilityIdentifier("recently.composer.error")
                }
            }

            inputRow
        }
        .padding(.horizontal, Spacing.small)
        .padding(.vertical, Spacing.xSmall)
        .onChange(of: store.text) { _, _ in
            store.textDidChange()
        }
        .onChange(of: store.contextSearch) { _, _ in
            store.contextSearchDidChange()
        }
        .onChange(of: store.focusRequestID) { _, _ in
            inputFocused = true
        }
        .onChange(of: store.dismissRequestID) { _, _ in
            inputFocused = false
        }
    }

    @ViewBuilder
    private var metadataTray: some View {
        if store.context != nil || !store.selectedLinks.isEmpty {
            RecentlyComposerSelectionTray(store: store)
        }
    }

    private var editingBanner: some View {
        HStack(spacing: Spacing.small) {
            Label("Editing", systemImage: "pencil")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color(SpacePalette.accent))
            Spacer()
            Button("Cancel") {
                store.cancelEditing()
            }
            .font(.caption)
            .buttonStyle(.plain)
            .foregroundStyle(Color(SpacePalette.accent))
        }
        .frame(minHeight: 24)
    }

    private func executeSlashCommand(_ command: RecentlySlashCommand) {
        store.executeSlashCommand(command)
    }

    private var inputRow: some View {
        HStack(alignment: .bottom, spacing: Spacing.xSmall) {
            Button {
                store.toggleContextPicker()
            } label: {
                Image(systemName: "paperclip")
                    .font(.system(size: 22, weight: .medium))
                    .foregroundStyle(
                        store.context != nil || store.isChoosingContext || !store.links.isEmpty
                            ? Color(SpacePalette.accent)
                            : Color(SpacePalette.primary)
                    )
                    .frame(width: 44, height: 44)
                    .background {
                        if reduceTransparency {
                            Circle().fill(Color(SpacePalette.surface))
                        } else {
                            Circle()
                                .fill(.clear)
                                .glassEffect(.regular.interactive(), in: Circle())
                        }
                    }
                    .overlay {
                        Circle()
                            .stroke(Color.white.opacity(0.52), lineWidth: 0.5)
                    }
                    .contentShape(Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Add context or media")
            .accessibilityHint("Search internal context or TMDB")
            .accessibilityIdentifier("recently.composer.context")

            HStack(alignment: .bottom, spacing: 0) {
                TextField(inputPlaceholder, text: inputText, axis: .vertical)
                    .lineLimit(store.isChoosingContext ? 1 ... 1 : 1 ... 6)
                    .focused($inputFocused)
                    .font(.body)
                    .autocorrectionDisabled(store.isChoosingContext)
                    .padding(.leading, 14)
                    .padding(.vertical, 10)
                    .frame(minHeight: 44, alignment: .leading)
                    .layoutPriority(1)
                    .onSubmit {
                        guard !store.isChoosingContext else { return }
                        if let command = store.slashCommands.first {
                            executeSlashCommand(command)
                        }
                    }
                    .accessibilityIdentifier(
                        store.isChoosingContext
                            ? "recently.composer.attachment.search"
                            : "recently.composer.text"
                    )

                if store.isChoosingContext {
                    searchTrailingControl
                } else {
                    submitButton
                }
            }
            .background {
                let shape = RoundedRectangle(
                    cornerRadius: Radius.composer,
                    style: .continuous
                )
                if reduceTransparency {
                    shape.fill(Color(SpacePalette.inset))
                } else {
                    shape
                        .fill(.clear)
                        .glassEffect(.regular, in: shape)
                }
            }
            .overlay {
                RoundedRectangle(cornerRadius: Radius.composer, style: .continuous)
                    .stroke(Color.white.opacity(0.42), lineWidth: 0.5)
            }
        }
    }

    private var inputText: Binding<String> {
        Binding(
            get: { store.isChoosingContext ? store.contextSearch : store.text },
            set: { value in
                if store.isChoosingContext {
                    store.contextSearch = value
                } else {
                    store.text = value
                }
            }
        )
    }

    private var inputPlaceholder: String {
        store.isChoosingContext ? store.attachmentSearchPlaceholder : "Share something…"
    }

    @ViewBuilder
    private var searchTrailingControl: some View {
        if store.contextSearch.isEmpty {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(Color(SpacePalette.subtle))
                .frame(width: 44, height: 44)
                .accessibilityHidden(true)
        } else {
            Button("Clear search", systemImage: "xmark.circle.fill") {
                store.contextSearch = ""
            }
            .labelStyle(.iconOnly)
            .buttonStyle(.plain)
            .font(.system(size: 17, weight: .semibold))
            .foregroundStyle(Color(SpacePalette.subtle))
            .frame(width: 44, height: 44)
            .contentShape(.rect)
        }
    }

    private var submitButton: some View {
        Button {
            if let command = store.slashCommands.first {
                executeSlashCommand(command)
            } else {
                Task { await store.submit() }
            }
        } label: {
            Group {
                if store.isSaving {
                    ProgressView()
                        .controlSize(.small)
                } else {
                    Image(systemName: "paperplane.fill")
                }
            }
            .font(.system(size: 17, weight: .semibold))
            .foregroundStyle(.white)
            .frame(width: 40, height: 40)
            .background {
                let tint = store.canSubmit || store.isSaving
                    ? Color(SpacePalette.accent)
                    : Color(SpacePalette.subtle).opacity(0.18)
                if reduceTransparency {
                    Circle().fill(tint)
                } else {
                    Circle()
                        .fill(.clear)
                        .glassEffect(.regular.tint(tint).interactive(), in: Circle())
                }
            }
            .overlay {
                Circle()
                    .stroke(Color.white.opacity(0.58), lineWidth: 0.5)
            }
        }
        .buttonStyle(.plain)
        .frame(width: 44, height: 44)
        .contentShape(.rect)
        .disabled(!store.canSubmit)
        .accessibilityLabel(submitAccessibilityLabel)
        .accessibilityIdentifier("recently.composer.post")
    }

    private var submitAccessibilityLabel: String {
        if store.isSaving { return "Publishing" }
        if let command = store.slashCommands.first { return "Run \(command.title)" }
        return store.isEditing ? "Save" : "Publish"
    }
}
