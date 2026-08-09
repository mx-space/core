import Foundation
import SpaceCore

@MainActor
@Observable
final class RecentlyStore {
    private(set) var entries: [RecentlyCard] = []
    private(set) var isLoading = false
    private(set) var errorMessage: String?

    private let service: RecentlyService

    init(service: RecentlyService) {
        self.service = service
    }

    func reload() async {
        isLoading = true
        defer { isLoading = false }
        do {
            entries = try await service.list()
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func loadMore() async {
        guard let cursor = entries.last?.id, !isLoading else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            let page = try await service.list(before: cursor)
            let known = Set(entries.map(\.id))
            entries += page.filter { !known.contains($0.id) }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Returns nil on success, or a message the composer shows in place —
    /// a failed post must never look like a silent no-op.
    func post(
        _ content: String,
        context: RecentlyContext? = nil,
        selectedEnrichmentURLs: [String]? = nil
    ) async -> String? {
        do {
            _ = try await service.create(
                content: content,
                context: context,
                selectedEnrichmentURLs: selectedEnrichmentURLs
            )
            await reload()
            return nil
        } catch {
            errorMessage = error.localizedDescription
            return error.localizedDescription
        }
    }

    func save(
        id: String?,
        content: String,
        context: RecentlyContext?,
        selectedEnrichmentURLs: [String]
    ) async -> String? {
        do {
            if let id {
                _ = try await service.update(
                    id: id,
                    content: content,
                    context: context,
                    clearContext: context == nil,
                    selectedEnrichmentURLs: selectedEnrichmentURLs
                )
            } else {
                _ = try await service.create(
                    content: content,
                    context: context,
                    selectedEnrichmentURLs: selectedEnrichmentURLs
                )
            }
            await reload()
            return nil
        } catch {
            errorMessage = error.localizedDescription
            return error.localizedDescription
        }
    }

    func delete(id: String) async {
        let snapshot = entries
        entries.removeAll { $0.id == id }
        do {
            try await service.delete(id: id)
        } catch {
            entries = snapshot
            errorMessage = error.localizedDescription
        }
    }
}
