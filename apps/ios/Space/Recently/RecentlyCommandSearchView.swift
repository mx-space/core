import SpaceCore
import SpaceUI
import SwiftUI

struct RecentlyCommandSearchView: View {
    @Bindable var store: RecentlyComposerStore

    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    private let contextRowHeight: CGFloat = 46
    private let mediaRowHeight: CGFloat = 58

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider()
            results
        }
        .background {
            let shape = RoundedRectangle(cornerRadius: Radius.sheet, style: .continuous)
            if reduceTransparency {
                shape.fill(Color(SpacePalette.surface))
            } else {
                shape
                    .fill(.clear)
                    .glassEffect(.regular, in: shape)
            }
        }
        .clipShape(.rect(cornerRadius: Radius.sheet, style: .continuous))
    }

    private var header: some View {
        HStack(spacing: Spacing.xSmall) {
            if store.activeCommand != nil {
                Button("Back to commands", systemImage: "chevron.left") {
                    store.returnToSlashMenu()
                }
                .labelStyle(.iconOnly)
                .buttonStyle(.plain)
                .foregroundStyle(Color(SpacePalette.primary))
                .frame(width: 36, height: 40)
                .contentShape(.rect)
                .accessibilityIdentifier("recently.composer.command.back")
            } else {
                Image(systemName: "paperclip")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Color(SpacePalette.accent))
                    .frame(width: 36, height: 40)
            }

            Text(store.activeCommand?.detailTitle ?? "Add context or media")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Color(SpacePalette.primary))
                .lineLimit(1)
                .accessibilityIdentifier("recently.composer.command.detail")

            Spacer(minLength: Spacing.small)

            Button("Close search", systemImage: "xmark") {
                store.dismissAttachmentSearch()
            }
            .labelStyle(.iconOnly)
            .buttonStyle(.plain)
            .foregroundStyle(Color(SpacePalette.subtle))
            .frame(width: 36, height: 40)
            .contentShape(.rect)
            .accessibilityIdentifier("recently.composer.command.close")
        }
        .padding(.horizontal, Spacing.small)
        .frame(height: 42)
    }

    private var results: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                if store.showsContextSearchResults {
                    contextResults
                }

                if store.showsTMDBSearchResults, !trimmedQuery.isEmpty {
                    tmdbResults
                }

                if showsEmptyState {
                    emptyState
                }
            }
        }
        .scrollIndicators(.hidden)
        .frame(height: resultsHeight)
        .accessibilityLabel("Search results")
    }

    @ViewBuilder
    private var contextResults: some View {
        if showsBothResultKinds, !store.contextCandidates.isEmpty {
            sectionHeader("Space")
        }

        if store.isLoadingContexts, store.contextCandidates.isEmpty {
            loadingRow("Searching Space…")
        } else {
            ForEach(store.contextCandidates) { candidate in
                contextRow(candidate)
            }
        }
    }

    @ViewBuilder
    private var tmdbResults: some View {
        if showsBothResultKinds,
           store.isLoadingTMDB || !store.tmdbCandidates.isEmpty
        {
            sectionHeader("TMDB")
        }

        if store.isLoadingTMDB, store.tmdbCandidates.isEmpty {
            loadingRow("Searching TMDB…")
        } else {
            ForEach(store.tmdbCandidates) { candidate in
                tmdbRow(candidate)
            }
        }
    }

    private func sectionHeader(_ title: String) -> some View {
        Text(title.uppercased())
            .font(.system(size: 10, weight: .semibold))
            .tracking(0.7)
            .foregroundStyle(Color(SpacePalette.subtle))
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, Spacing.medium)
            .frame(height: 26)
    }

    private func loadingRow(_ title: String) -> some View {
        HStack(spacing: Spacing.small) {
            ProgressView()
                .controlSize(.small)
            Text(title)
                .font(.caption)
                .foregroundStyle(Color(SpacePalette.muted))
        }
        .frame(maxWidth: .infinity)
        .frame(height: 64)
    }

    private func contextRow(_ candidate: RecentlyContext) -> some View {
        Button {
            store.selectContext(candidate)
        } label: {
            HStack(spacing: Spacing.small) {
                Image(systemName: candidate.kind.systemImage)
                    .font(.system(size: 17, weight: .medium))
                    .foregroundStyle(Color(SpacePalette.accent))
                    .frame(width: 24)

                VStack(alignment: .leading, spacing: 1) {
                    Text(candidate.title)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Color(SpacePalette.primary))
                        .lineLimit(1)
                    Text(candidate.kind.title)
                        .font(.caption2)
                        .foregroundStyle(Color(SpacePalette.subtle))
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                Image(systemName: "plus.circle")
                    .font(.subheadline)
                    .foregroundStyle(Color(SpacePalette.subtle))
            }
            .padding(.horizontal, Spacing.medium)
            .frame(height: contextRowHeight)
            .contentShape(.rect)
            .overlay(alignment: .bottom) {
                Divider().padding(.leading, 44)
            }
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(
            "recently.composer.context.candidate.\(candidate.kind.rawValue).\(candidate.id)"
        )
        .accessibilityLabel("Attach \(candidate.kind.title), \(candidate.title)")
    }

    private func tmdbRow(_ card: MediaCard) -> some View {
        Button {
            store.selectTMDB(card)
        } label: {
            HStack(spacing: Spacing.small) {
                ComposerArtwork(url: card.artworkURL, accent: card.accent)
                    .frame(width: 32, height: 48)
                    .clipShape(.rect(cornerRadius: 6))

                VStack(alignment: .leading, spacing: 2) {
                    Text(card.title)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Color(SpacePalette.primary))
                        .lineLimit(1)
                    Text(card.topCaps ?? (card.metaLine.isEmpty ? "TMDB" : card.metaLine))
                        .font(.caption2)
                        .foregroundStyle(Color(SpacePalette.subtle))
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                Image(systemName: "plus.circle")
                    .font(.subheadline)
                    .foregroundStyle(Color(SpacePalette.subtle))
            }
            .padding(.horizontal, Spacing.medium)
            .frame(height: mediaRowHeight)
            .contentShape(.rect)
            .overlay(alignment: .bottom) {
                Divider().padding(.leading, 52)
            }
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("recently.composer.tmdb.candidate.\(card.id)")
        .accessibilityLabel("Attach \(card.title) from TMDB")
    }

    private var emptyState: some View {
        HStack(spacing: Spacing.xSmall) {
            Image(systemName: emptyStateIcon)
                .font(.subheadline)
                .foregroundStyle(Color(SpacePalette.subtle))
            Text(emptyStateTitle)
                .font(.caption)
                .foregroundStyle(Color(SpacePalette.muted))
                .lineLimit(2)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 52)
        .padding(.horizontal, Spacing.regular)
    }

    private var trimmedQuery: String {
        store.contextSearch.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var showsBothResultKinds: Bool {
        store.showsContextSearchResults && store.showsTMDBSearchResults
    }

    private var showsEmptyState: Bool {
        let hasContext = !store.contextCandidates.isEmpty
        let hasTMDB = !store.tmdbCandidates.isEmpty
        let isLoading = store.isLoadingContexts || store.isLoadingTMDB
        if store.showsTMDBSearchResults, !store.showsContextSearchResults, trimmedQuery.isEmpty {
            return true
        }
        return !hasContext && !hasTMDB && !isLoading
    }

    private var emptyStateIcon: String {
        store.errorMessage == nil ? "magnifyingglass" : "exclamationmark.triangle"
    }

    private var emptyStateTitle: String {
        if store.errorMessage != nil {
            return "Search is unavailable. Check the Space server connection."
        }
        if store.showsTMDBSearchResults, !store.showsContextSearchResults, trimmedQuery.isEmpty {
            return "Type a movie or TV title below"
        }
        if store.showsContextSearchResults, trimmedQuery.isEmpty {
            return "Type below to search Space"
        }
        return "No matching content"
    }

    private var resultsHeight: CGFloat {
        if showsEmptyState { return 52 }

        var height: CGFloat = 0
        if store.showsContextSearchResults {
            if store.isLoadingContexts, store.contextCandidates.isEmpty {
                height += 64
            } else {
                height += CGFloat(store.contextCandidates.count) * contextRowHeight
                if showsBothResultKinds, !store.contextCandidates.isEmpty { height += 26 }
            }
        }
        if store.showsTMDBSearchResults, !trimmedQuery.isEmpty {
            if store.isLoadingTMDB, store.tmdbCandidates.isEmpty {
                height += 64
            } else {
                height += CGFloat(store.tmdbCandidates.count) * mediaRowHeight
                if showsBothResultKinds, !store.tmdbCandidates.isEmpty { height += 26 }
            }
        }
        return min(max(height, 64), 212)
    }
}
