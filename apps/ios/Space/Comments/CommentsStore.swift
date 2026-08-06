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
        defer { isLoading = false }
        do {
            let snapshot = try await service.load(filter: filter)
            comments = snapshot.comments
            counts = snapshot.counts
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func setState(id: String, state: Int) async {
        let snapshot = comments
        comments.removeAll { $0.id == id }
        do {
            try await service.setState(id: id, state: state)
            await reload()
        } catch {
            comments = snapshot
            errorMessage = error.localizedDescription
        }
    }
}
