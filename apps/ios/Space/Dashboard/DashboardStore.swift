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

    private let service: DashboardService

    init(service: DashboardService) {
        self.service = service
    }

    func load() async {
        if case .loading = state { return }
        state = .loading
        do {
            state = .loaded(try await service.load())
        } catch {
            state = .failed(error.localizedDescription)
        }
    }
}
