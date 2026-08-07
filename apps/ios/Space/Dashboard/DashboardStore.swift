import Foundation
import SpaceCore

@MainActor
@Observable
final class DashboardStore {
    enum State {
        case idle
        case loading
        case loaded(DashboardSnapshot)
        case failed(String)
    }

    private(set) var state: State = .idle
    private(set) var isRefreshing = false
    private(set) var refreshError: String?

    private let service: DashboardService

    init(service: DashboardService) {
        self.service = service
    }

    func load() async {
        guard !isRefreshing else { return }
        let hasContent = if case .loaded = state { true } else { false }
        if !hasContent { state = .loading }
        isRefreshing = true
        defer { isRefreshing = false }
        do {
            state = .loaded(try await service.load())
            refreshError = nil
        } catch {
            if hasContent {
                refreshError = error.localizedDescription
            } else {
                state = .failed(error.localizedDescription)
            }
        }
    }
}
