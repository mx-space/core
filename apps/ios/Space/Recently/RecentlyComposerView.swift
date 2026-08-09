import SpaceCore
import SpaceUI
import SwiftUI

struct RecentlyInlineComposerView: View {
    @Bindable var store: RecentlyComposerStore
    @FocusState private var inputFocused: Bool

    var body: some View {
        VStack(spacing: Spacing.xSmall) {
            if store.isEditing {
                editingBanner
            }

            metadataTray

            if let error = store.errorMessage {
                Label(error, systemImage: "exclamationmark.triangle")
                    .font(.caption)
                    .foregroundStyle(Color(SpacePalette.danger))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .lineLimit(2)
                    .accessibilityIdentifier("recently.composer.error")
            }

            inputRow
        }
        .padding(.horizontal, Spacing.regular)
        .padding(.vertical, Spacing.small)
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
        if store.context != nil || store.isChoosingContext || !store.links.isEmpty {
            VStack(spacing: Spacing.xSmall) {
                if store.isChoosingContext {
                    contextCandidates
                } else if let context = store.context {
                    RecentlyContextCardView(context: context) {
                        store.removeContext()
                    }
                }

                if !store.links.isEmpty {
                    ScrollView(.horizontal) {
                        LazyHStack(spacing: Spacing.small) {
                            ForEach(store.links) { preview in
                                ComposerLinkSelectionCard(preview: preview) {
                                    store.toggleLink(preview.url)
                                }
                            }
                        }
                    }
                    .scrollIndicators(.hidden)
                    .frame(height: 84)
                    .accessibilityLabel("Link enrichments")
                }
            }
            .frame(maxHeight: 140)
            .clipped()
        }
    }

    private var contextCandidates: some View {
        ScrollView(.horizontal) {
            LazyHStack(spacing: Spacing.small) {
                HStack(spacing: Spacing.small) {
                    Image(systemName: "magnifyingglass")
                        .font(.caption)
                        .foregroundStyle(Color(SpacePalette.subtle))
                    TextField("Find context", text: $store.contextSearch)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .font(.caption)
                }
                .padding(.horizontal, Spacing.medium)
                .frame(width: 142, height: 44)
                .background(Color(SpacePalette.inset), in: .rect(cornerRadius: Radius.control))

                if store.isLoadingContexts {
                    ProgressView()
                        .frame(width: 44, height: 44)
                        .accessibilityLabel("Loading context")
                } else if store.contextCandidates.isEmpty {
                    Text("No matches")
                        .font(.caption)
                        .foregroundStyle(Color(SpacePalette.subtle))
                        .frame(height: 44)
                } else {
                    ForEach(store.contextCandidates) { candidate in
                        Button {
                            store.selectContext(candidate)
                        } label: {
                            HStack(spacing: Spacing.small) {
                                Image(systemName: candidate.kind.systemImage)
                                    .foregroundStyle(Color(SpacePalette.accent))
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(candidate.kind.title)
                                        .font(.caption2)
                                        .foregroundStyle(Color(SpacePalette.subtle))
                                    Text(candidate.title)
                                        .font(.caption.weight(.medium))
                                        .foregroundStyle(Color(SpacePalette.primary))
                                        .lineLimit(1)
                                }
                            }
                            .padding(.horizontal, Spacing.medium)
                            .frame(width: 174, height: 44, alignment: .leading)
                            .background(
                                Color(SpacePalette.inset),
                                in: .rect(cornerRadius: Radius.control)
                            )
                            .overlay {
                                RoundedRectangle(cornerRadius: Radius.control, style: .continuous)
                                    .stroke(Color(.separator).opacity(0.4), lineWidth: 0.5)
                            }
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier(
                            "recently.composer.context.candidate.\(candidate.kind.rawValue).\(candidate.id)"
                        )
                    }
                }
            }
        }
        .scrollIndicators(.hidden)
        .frame(height: 44)
        .accessibilityLabel("Choose context")
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

    private var inputRow: some View {
        HStack(alignment: .bottom, spacing: Spacing.small) {
            Button("Choose context", systemImage: "paperclip") {
                store.toggleContextPicker()
                inputFocused = true
            }
            .labelStyle(.iconOnly)
            .font(.body.weight(.medium))
            .buttonStyle(.glass)
            .tint(
                store.context != nil || store.isChoosingContext
                    ? Color(SpacePalette.accent)
                    : Color(SpacePalette.muted)
            )
            .frame(width: 44, height: 44)
            .accessibilityIdentifier("recently.composer.context")

            TextField("Share something…", text: $store.text, axis: .vertical)
                .lineLimit(1 ... 6)
                .focused($inputFocused)
                .font(.body)
                .composerFieldSurface()
                .accessibilityIdentifier("recently.composer.text")

            Group {
                if store.isSaving {
                    ProgressView()
                        .frame(width: 44, height: 44)
                } else {
                    Button(store.isEditing ? "Save" : "Publish", systemImage: "arrow.up") {
                        Task { await store.submit() }
                    }
                    .labelStyle(.iconOnly)
                    .font(.body.weight(.semibold))
                    .buttonStyle(.glassProminent)
                    .tint(Color(SpacePalette.accent))
                    .disabled(!store.canSubmit)
                    .frame(width: 44, height: 44)
                    .accessibilityIdentifier("recently.composer.post")
                }
            }
        }
    }
}

private struct ComposerLinkSelectionCard: View {
    let preview: ComposerLinkPreview
    let toggle: () -> Void

    var body: some View {
        Button(action: toggle) {
            Group {
                if let card = preview.card {
                    switch card.variant {
                    case .poster:
                        poster(card)
                    case .fallback:
                        fallback(card)
                    }
                } else {
                    unresolved
                }
            }
            .frame(width: 184, height: 80)
            .background(Color(SpacePalette.inset), in: .rect(cornerRadius: Radius.control))
            .overlay {
                RoundedRectangle(cornerRadius: Radius.control, style: .continuous)
                    .stroke(
                        preview.isSelected
                            ? Color(SpacePalette.accent)
                            : Color(.separator).opacity(0.5),
                        lineWidth: preview.isSelected ? 2 : 0.5
                    )
            }
            .overlay(alignment: .topTrailing) {
                Image(systemName: preview.isSelected ? "checkmark.circle.fill" : "circle")
                    .font(.caption)
                    .foregroundStyle(
                        preview.isSelected
                            ? Color(SpacePalette.accent)
                            : Color(SpacePalette.subtle)
                    )
                    .padding(6)
            }
            .opacity(preview.isSelected ? 1 : 0.58)
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("recently.composer.enrichment")
        .accessibilityLabel("\(preview.card?.title ?? preview.url), link enrichment")
        .accessibilityValue(preview.isSelected ? "Selected" : "Not selected")
    }

    private func poster(_ card: MediaCard) -> some View {
        HStack(spacing: Spacing.small) {
            ComposerArtwork(url: card.artworkURL, accent: card.accent)
                .frame(width: 52, height: 80)
            copy(card)
                .padding(.trailing, Spacing.small)
        }
    }

    private func fallback(_ card: MediaCard) -> some View {
        HStack(spacing: Spacing.small) {
            copy(card)
                .padding(.leading, Spacing.medium)
            if card.artworkURL != nil {
                ComposerArtwork(url: card.artworkURL, accent: card.accent)
                    .frame(width: 52, height: 52)
                    .clipShape(.rect(cornerRadius: 8))
                    .padding(.trailing, Spacing.small)
            }
        }
    }

    private func copy(_ card: MediaCard) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(card.category.uppercased())
                .font(.system(size: 9, weight: .semibold))
                .tracking(0.8)
                .foregroundStyle(Color(SpacePalette.subtle))
            Text(card.title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color(SpacePalette.primary))
                .lineLimit(2)
            Text(card.host ?? card.metaLine)
                .font(.caption2)
                .foregroundStyle(Color(SpacePalette.muted))
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var unresolved: some View {
        HStack(spacing: Spacing.medium) {
            Image(systemName: "link")
                .font(.title3)
                .foregroundStyle(Color(SpacePalette.muted))
            VStack(alignment: .leading, spacing: Spacing.xSmall) {
                Text(URL(string: preview.url)?.host() ?? "Link")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color(SpacePalette.primary))
                    .lineLimit(1)
                Text(preview.isResolving ? "Resolving…" : "No rich preview")
                    .font(.caption2)
                    .foregroundStyle(Color(SpacePalette.subtle))
            }
            Spacer(minLength: 0)
            if preview.isResolving { ProgressView().controlSize(.small) }
        }
        .padding(.horizontal, Spacing.medium)
    }
}

private struct ComposerArtwork: View {
    let url: URL?
    let accent: Color

    var body: some View {
        AsyncImage(url: url) { image in
            image.resizable().scaledToFill()
        } placeholder: {
            Rectangle().fill(accent.opacity(0.18))
        }
        .clipped()
    }
}
