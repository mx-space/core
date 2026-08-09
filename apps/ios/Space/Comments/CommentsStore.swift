import Foundation
import SpaceCore

@MainActor
@Observable
final class CommentsStore {
    private(set) var comments: [Components.Schemas.CommentRow] = []
    private(set) var counts: Components.Schemas.CommentTabCounts?
    private(set) var isLoading = false
    private(set) var errorMessage: String?
    var filter: CommentFilter = .unread

    let service: CommentService

    init(service: CommentService) {
        self.service = service
    }

    func reload() async {
        guard !isLoading else { return }
        isLoading = true
        while true {
            let requestedFilter = filter
            do {
                let snapshot = try await service.load(filter: requestedFilter)
                if filter == requestedFilter {
                    comments = snapshot.comments
                    counts = snapshot.counts
                    errorMessage = nil
                }
            } catch {
                if filter == requestedFilter { errorMessage = error.localizedDescription }
            }
            if filter == requestedFilter { break }
        }
        isLoading = false
    }

    func setState(id: String, state: CommentState) async {
        let snapshot = comments
        if let index = comments.firstIndex(where: { $0.id == id }) {
            comments[index].state = state.rawValue
        }
        do {
            try await service.setState(id: id, state: state)
            await reload()
        } catch {
            comments = snapshot
            errorMessage = error.localizedDescription
        }
    }
}
