import Foundation
import SpaceCore

@MainActor
@Observable
final class CommentDetailStore {
    enum State {
        case loading
        case loaded(Components.Schemas.CommentDetail)
        case failed(String)
    }

    private(set) var state: State = .loading
    private(set) var isSending = false
    private(set) var errorMessage: String?

    private let service: CommentService
    private let id: String

    var commentState: CommentState? {
        guard case let .loaded(comment) = state else { return nil }
        return CommentState(rawValue: comment.state)
    }

    init(service: CommentService, seed: Components.Schemas.CommentRow) {
        self.service = service
        self.id = seed.id
    }

    init(service: CommentService, id: String) {
        self.service = service
        self.id = id
    }

    func load() async {
        do {
            state = .loaded(try await service.detail(id: id))
            errorMessage = nil
        } catch {
            state = .failed(error.localizedDescription)
        }
    }

    func reply(_ text: String) async -> Bool {
        isSending = true
        defer { isSending = false }
        do {
            _ = try await service.reply(id: id, text: text)
            state = .loaded(try await service.detail(id: id))
            errorMessage = nil
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func markJunk() async -> Bool {
        await setState(.junk, reload: false)
    }

    func markRead(_ read: Bool) async -> Bool {
        await setState(read ? .read : .unread, reload: true)
    }

    private func setState(_ newState: CommentState, reload: Bool) async -> Bool {
        do {
            try await service.setState(id: id, state: newState)
            if reload { state = .loaded(try await service.detail(id: id)) }
            errorMessage = nil
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func delete() async -> Bool {
        do {
            try await service.delete(id: id)
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }
}
