import Foundation
import SpaceCore

@MainActor
@Observable
final class MovementStore {
    enum State {
        case idle
        case loading
        case loaded(MovementSnapshot)
        case failed(String)
    }

    private(set) var state: State = .idle
    private(set) var isRefreshing = false
    private(set) var refreshError: String?
    private let service: MovementService
    private var requestedDays = 1

    init(service: MovementService) {
        self.service = service
    }

    func load(days: Int = 1) async {
        requestedDays = days
        guard !isRefreshing else { return }
        let hasContent = if case .loaded = state { true } else { false }
        if !hasContent { state = .loading }
        isRefreshing = true
        while true {
            let days = requestedDays
            do {
                let snapshot = try await service.load(days: days)
                if requestedDays == days {
                    state = .loaded(snapshot)
                    refreshError = nil
                }
            } catch {
                if requestedDays == days {
                    if hasContent {
                        refreshError = error.localizedDescription
                    } else {
                        state = .failed(error.localizedDescription)
                    }
                }
            }
            if requestedDays == days { break }
        }
        isRefreshing = false
    }
}
