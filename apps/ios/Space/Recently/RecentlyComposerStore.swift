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
    private struct DraftState {
        let text: String
        let context: RecentlyContext?
        let links: [ComposerLinkPreview]
        let selectionOverrides: [String: Bool]
    }

    var text = ""
    var contextSearch = ""

    private(set) var context: RecentlyContext?
    private(set) var contextCandidates: [RecentlyContext] = []
    private(set) var links: [ComposerLinkPreview] = []
    private(set) var isChoosingContext = false
    private(set) var isLoadingContexts = false
    private(set) var isSaving = false
    private(set) var editingID: String?
    private(set) var errorMessage: String?
    private(set) var focusRequestID = 0
    private(set) var dismissRequestID = 0

    var isEditing: Bool { editingID != nil }
    var canSubmit: Bool {
        !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isSaving
    }

    private let service: RecentlyService
    private let contentStore: RecentlyStore
    private let onSaved: () -> Void

    private var suspendedDraft: DraftState?
    private var selectionOverrides: [String: Bool] = [:]
    private var linkGeneration = 0
    private var contextGeneration = 0
    private var linkResolutionTask: Task<Void, Never>?
    private var contextSearchTask: Task<Void, Never>?

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
        let urls = Self.uniqueURLs(in: text)
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
        links[index].isSelected.toggle()
        selectionOverrides[url] = links[index].isSelected
        errorMessage = nil
    }

    func focusInput() {
        focusRequestID &+= 1
    }

    func toggleContextPicker() {
        isChoosingContext.toggle()
        guard isChoosingContext else { return }
        if contextCandidates.isEmpty {
            scheduleContextSearch(immediate: true)
        }
    }

    func contextSearchDidChange() {
        scheduleContextSearch(immediate: false)
    }

    func selectContext(_ candidate: RecentlyContext) {
        context = candidate
        isChoosingContext = false
        contextSearch = ""
        errorMessage = nil
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
                selectionOverrides: selectionOverrides
            )
        }

        editingID = entry.id
        text = entry.content
        context = entry.context
        errorMessage = nil
        isChoosingContext = false
        contextSearch = ""

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

    private func loadContextCandidates(generation: Int) async {
        isLoadingContexts = true
        defer {
            if generation == contextGeneration { isLoadingContexts = false }
        }
        do {
            let candidates = try await service.refCandidates(search: contextSearch)
            if generation == contextGeneration {
                contextCandidates = candidates
            }
        } catch {
            if generation == contextGeneration {
                contextCandidates = []
                errorMessage = error.localizedDescription
            }
        }
    }

    private func restoreSuspendedDraft() {
        editingID = nil
        if let suspendedDraft {
            text = suspendedDraft.text
            context = suspendedDraft.context
            links = suspendedDraft.links
            selectionOverrides = suspendedDraft.selectionOverrides
        } else {
            resetDraft()
        }
        self.suspendedDraft = nil
        errorMessage = nil
        isChoosingContext = false
        contextSearch = ""
        textDidChange()
    }

    private func resetDraft() {
        editingID = nil
        text = ""
        context = nil
        links = []
        selectionOverrides = [:]
        suspendedDraft = nil
        errorMessage = nil
        isChoosingContext = false
        contextSearch = ""
        linkResolutionTask?.cancel()
    }

    private static func uniqueURLs(in text: String) -> [String] {
        var seen = Set<String>()
        return RecentlyService.detectedURLs(in: text).filter { seen.insert($0).inserted }
    }
}
