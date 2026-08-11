import Foundation
import Observation
import SpaceCore

struct ComposerLinkPreview: Identifiable, Equatable {
    let url: String
    var card: MediaCard?
    var isSelected: Bool
    var isResolving: Bool

    var id: String { url }
}

@MainActor
@Observable
final class RecentlyComposerStore {
    private enum AttachmentSearchScope {
        case all
        case context
        case tmdb
    }

    private struct DraftState {
        let text: String
        let context: RecentlyContext?
        let links: [ComposerLinkPreview]
        let attachedURLs: [String]
        let selectionOverrides: [String: Bool]
    }

    var text = ""
    var contextSearch = ""

    private(set) var context: RecentlyContext?
    private(set) var contextCandidates: [RecentlyContext] = []
    private(set) var tmdbCandidates: [MediaCard] = []
    private(set) var links: [ComposerLinkPreview] = []
    private(set) var isChoosingContext = false
    private(set) var isLoadingContexts = false
    private(set) var isLoadingTMDB = false
    private(set) var isSaving = false
    private(set) var editingID: String?
    private(set) var activeCommand: RecentlySlashCommand?
    private(set) var errorMessage: String?
    private(set) var focusRequestID = 0
    private(set) var dismissRequestID = 0

    var isEditing: Bool { editingID != nil }
    var slashCommands: [RecentlySlashCommand] {
        guard !isChoosingContext, !isSaving else { return [] }
        return RecentlySlashCommand.suggestions(for: text)
    }

    var isShowingSlashMenu: Bool { !slashCommands.isEmpty }
    var isShowingComposerPanel: Bool { isShowingSlashMenu || isChoosingContext }
    var selectedLinks: [ComposerLinkPreview] { links.filter(\.isSelected) }
    var showsContextSearchResults: Bool { attachmentSearchScope != .tmdb }
    var showsTMDBSearchResults: Bool { attachmentSearchScope != .context }
    var attachmentSearchPlaceholder: String {
        guard attachmentSearchScope == .context else {
            return attachmentSearchScope == .tmdb ? "Search TMDB" : "TMDB or context"
        }
        return switch contextKindFilter {
        case .post: "Search posts"
        case .note: "Search notes"
        case .page: "Search pages"
        case .recently: "Search Recently"
        case nil: "Search Space"
        }
    }

    var canSubmit: Bool {
        let hasText = !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        let hasSelectedEnrichment = links.contains(where: \.isSelected)
        return (hasText || hasSelectedEnrichment) && !isSaving
    }

    private let service: RecentlyService
    private let contentStore: RecentlyStore
    private let onSaved: () -> Void

    private var suspendedDraft: DraftState?
    private var attachedURLs: [String] = []
    private var selectionOverrides: [String: Bool] = [:]
    private var linkGeneration = 0
    private var contextGeneration = 0
    private var tmdbGeneration = 0
    private var attachmentSearchScope: AttachmentSearchScope = .all
    private var contextKindFilter: RecentlyContext.Kind?
    private var linkResolutionTask: Task<Void, Never>?
    private var contextSearchTask: Task<Void, Never>?
    private var tmdbSearchTask: Task<Void, Never>?

    init(
        service: RecentlyService,
        contentStore: RecentlyStore,
        onSaved: @escaping () -> Void
    ) {
        self.service = service
        self.contentStore = contentStore
        self.onSaved = onSaved
    }

    func textDidChange() {
        errorMessage = nil
        linkGeneration &+= 1
        let generation = linkGeneration
        let detectedURLs = Self.uniqueURLs(in: text)
        let urls = detectedURLs + attachedURLs.filter { !detectedURLs.contains($0) }
        let existing = Dictionary(uniqueKeysWithValues: links.map { ($0.url, $0) })

        links = urls.map { url in
            if var preview = existing[url] {
                preview.isSelected = selectionOverrides[url] ?? preview.isSelected
                return preview
            }
            let selected = selectionOverrides[url] ?? true
            selectionOverrides[url] = selected
            return ComposerLinkPreview(
                url: url,
                card: nil,
                isSelected: selected,
                isResolving: true
            )
        }

        linkResolutionTask?.cancel()
        let unresolved = links.filter(\.isResolving).map(\.url)
        guard !unresolved.isEmpty else { return }
        linkResolutionTask = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(450))
            guard !Task.isCancelled, let self else { return }
            await resolve(urls: unresolved, generation: generation)
        }
    }

    func toggleLink(_ url: String) {
        guard let index = links.firstIndex(where: { $0.url == url }) else { return }
        if attachedURLs.contains(url), !Self.uniqueURLs(in: text).contains(url) {
            attachedURLs.removeAll { $0 == url }
            links.remove(at: index)
            selectionOverrides.removeValue(forKey: url)
            errorMessage = nil
            return
        }
        links[index].isSelected.toggle()
        selectionOverrides[url] = links[index].isSelected
        errorMessage = nil
    }

    func focusInput() {
        focusRequestID &+= 1
    }

    func toggleContextPicker() {
        errorMessage = nil
        if isChoosingContext {
            dismissAttachmentSearch()
            return
        }
        openAttachmentSearch(scope: .all)
    }

    func contextSearchDidChange() {
        guard isChoosingContext else { return }
        errorMessage = nil
        scheduleContextSearch(immediate: false)
        scheduleTMDBSearch(immediate: false)
    }

    func selectContext(_ candidate: RecentlyContext) {
        context = candidate
        isChoosingContext = false
        clearAttachmentSearch()
        errorMessage = nil
        focusInput()
    }

    func selectTMDB(_ candidate: MediaCard) {
        guard let url = candidate.url?.absoluteString else { return }

        if !attachedURLs.contains(url) {
            attachedURLs.append(url)
        }
        selectionOverrides[url] = true
        if let index = links.firstIndex(where: { $0.url == url }) {
            links[index].card = candidate
            links[index].isSelected = true
            links[index].isResolving = false
        } else {
            links.append(
                ComposerLinkPreview(
                    url: url,
                    card: candidate,
                    isSelected: true,
                    isResolving: false
                )
            )
        }

        isChoosingContext = false
        clearAttachmentSearch()
        errorMessage = nil
        focusInput()
    }

    func executeSlashCommand(_ command: RecentlySlashCommand) {
        guard let invocation = RecentlySlashCommand.invocation(in: text) else { return }

        text.removeSubrange(invocation.range)
        switch command.searchScope {
        case .context:
            openAttachmentSearch(
                scope: .context,
                contextKind: command.contextKind,
                command: command
            )
        case .tmdb:
            openAttachmentSearch(scope: .tmdb, command: command)
        }
        errorMessage = nil
    }

    func dismissAttachmentSearch() {
        isChoosingContext = false
        clearAttachmentSearch()
        errorMessage = nil
        focusInput()
    }

    func returnToSlashMenu() {
        isChoosingContext = false
        clearAttachmentSearch()
        errorMessage = nil
        if let last = text.last, !last.isWhitespace {
            text.append(" ")
        }
        text.append("/")
        focusInput()
    }

    func removeContext() {
        context = nil
        errorMessage = nil
    }

    func beginEditing(_ entry: RecentlyCard) {
        if editingID == nil {
            suspendedDraft = DraftState(
                text: text,
                context: context,
                links: links,
                attachedURLs: attachedURLs,
                selectionOverrides: selectionOverrides
            )
        }

        editingID = entry.id
        text = entry.content
        context = entry.context
        errorMessage = nil
        isChoosingContext = false
        clearAttachmentSearch()
        attachedURLs = []

        let selected = entry.selectedEnrichmentURLs
        let enrichmentMap = entry.enrichments?.additionalProperties ?? [:]
        let urls = Self.uniqueURLs(in: entry.content)
        selectionOverrides = Dictionary(
            uniqueKeysWithValues: urls.map { ($0, selected.contains($0)) }
        )
        links = urls.map { url in
            ComposerLinkPreview(
                url: url,
                card: enrichmentMap[url].map(MediaCard.init),
                isSelected: selected.contains(url),
                isResolving: enrichmentMap[url] == nil
            )
        }
        textDidChange()
        focusInput()
    }

    func cancelEditing() {
        guard isEditing else { return }
        restoreSuspendedDraft()
    }

    func submit() async {
        guard canSubmit else { return }
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }

        let selectedURLs = links.filter(\.isSelected).map(\.url)
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        let prepared = RecentlyService.preparing(
            content: trimmed,
            selectedEnrichmentURLs: selectedURLs
        )
        let failure = await contentStore.save(
            id: editingID,
            content: prepared,
            context: context,
            selectedEnrichmentURLs: selectedURLs
        )

        if let failure {
            errorMessage = failure
            return
        }

        dismissRequestID &+= 1
        if isEditing {
            restoreSuspendedDraft()
        } else {
            resetDraft()
        }
        onSaved()
    }

    private func resolve(urls: [String], generation: Int) async {
        let service = service
        let results = await withTaskGroup(of: (String, MediaCard?).self) { group in
            for url in urls {
                group.addTask {
                    let result = try? await service.resolve(url: url)
                    return (url, result.flatMap { $0 }.map(MediaCard.init))
                }
            }

            var resolved: [(String, MediaCard?)] = []
            for await result in group { resolved.append(result) }
            return resolved
        }

        guard generation == linkGeneration else { return }
        for (url, card) in results {
            guard let index = links.firstIndex(where: { $0.url == url }) else { continue }
            links[index].card = card
            links[index].isResolving = false
        }
    }

    private func scheduleContextSearch(immediate: Bool) {
        guard attachmentSearchScope != .tmdb else {
            contextCandidates = []
            isLoadingContexts = false
            return
        }
        contextGeneration &+= 1
        let generation = contextGeneration
        contextSearchTask?.cancel()
        contextSearchTask = Task { [weak self] in
            if !immediate {
                try? await Task.sleep(for: .milliseconds(300))
            }
            guard !Task.isCancelled, let self else { return }
            await loadContextCandidates(generation: generation)
        }
    }

    private func scheduleTMDBSearch(immediate: Bool) {
        guard attachmentSearchScope != .context else {
            tmdbCandidates = []
            isLoadingTMDB = false
            return
        }
        tmdbGeneration &+= 1
        let generation = tmdbGeneration
        let query = contextSearch.trimmingCharacters(in: .whitespacesAndNewlines)
        tmdbSearchTask?.cancel()

        guard !query.isEmpty else {
            tmdbCandidates = []
            isLoadingTMDB = false
            return
        }

        tmdbSearchTask = Task { [weak self] in
            if !immediate {
                try? await Task.sleep(for: .milliseconds(350))
            }
            guard !Task.isCancelled, let self else { return }
            await loadTMDBCandidates(query: query, generation: generation)
        }
    }

    private func loadContextCandidates(generation: Int) async {
        isLoadingContexts = true
        defer {
            if generation == contextGeneration { isLoadingContexts = false }
        }
        do {
            let candidates = try await service.refCandidates(search: contextSearch)
            if generation == contextGeneration {
                contextCandidates = candidates.filter { candidate in
                    contextKindFilter == nil || candidate.kind == contextKindFilter
                }
            }
        } catch {
            if generation == contextGeneration {
                contextCandidates = []
                errorMessage = error.localizedDescription
            }
        }
    }

    private func loadTMDBCandidates(query: String, generation: Int) async {
        isLoadingTMDB = true
        defer {
            if generation == tmdbGeneration { isLoadingTMDB = false }
        }
        do {
            let results = try await service.searchTMDB(query: query)
            if generation == tmdbGeneration {
                tmdbCandidates = results.map(MediaCard.init)
            }
        } catch {
            if generation == tmdbGeneration {
                tmdbCandidates = []
                errorMessage = error.localizedDescription
            }
        }
    }

    private func clearAttachmentSearch() {
        contextGeneration &+= 1
        tmdbGeneration &+= 1
        contextSearchTask?.cancel()
        tmdbSearchTask?.cancel()
        contextSearch = ""
        contextCandidates = []
        tmdbCandidates = []
        isLoadingContexts = false
        isLoadingTMDB = false
        attachmentSearchScope = .all
        contextKindFilter = nil
        activeCommand = nil
    }

    private func openAttachmentSearch(
        scope: AttachmentSearchScope,
        contextKind: RecentlyContext.Kind? = nil,
        command: RecentlySlashCommand? = nil
    ) {
        clearAttachmentSearch()
        attachmentSearchScope = scope
        contextKindFilter = contextKind
        activeCommand = command
        isChoosingContext = true
        scheduleContextSearch(immediate: true)
        scheduleTMDBSearch(immediate: true)
        focusInput()
    }

    private func restoreSuspendedDraft() {
        editingID = nil
        if let suspendedDraft {
            text = suspendedDraft.text
            context = suspendedDraft.context
            links = suspendedDraft.links
            attachedURLs = suspendedDraft.attachedURLs
            selectionOverrides = suspendedDraft.selectionOverrides
        } else {
            resetDraft()
        }
        self.suspendedDraft = nil
        errorMessage = nil
        isChoosingContext = false
        clearAttachmentSearch()
        textDidChange()
    }

    private func resetDraft() {
        editingID = nil
        text = ""
        context = nil
        links = []
        attachedURLs = []
        selectionOverrides = [:]
        suspendedDraft = nil
        errorMessage = nil
        isChoosingContext = false
        clearAttachmentSearch()
        linkResolutionTask?.cancel()
    }

    private static func uniqueURLs(in text: String) -> [String] {
        var seen = Set<String>()
        return RecentlyService.detectedURLs(in: text).filter { seen.insert($0).inserted }
    }
}
