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

    /// Returns true when opening the detail also transitioned an unread
    /// comment to read, allowing the list badge to refresh once.
    func load() async -> Bool {
        do {
            var comment = try await service.detail(id: id)
            state = .loaded(comment)
            errorMessage = nil
            guard CommentState(rawValue: comment.state) == .unread else { return false }
            do {
                try await service.setState(id: id, state: CommentState.read)
                comment.state = CommentState.read.rawValue
                state = .loaded(comment)
                return true
            } catch {
                errorMessage = error.localizedDescription
                return false
            }
        } catch {
            state = .failed(error.localizedDescription)
            return false
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
        await setState(.junk)
    }

    func restore() async -> Bool {
        await setState(.read)
    }

    func markRead(_ read: Bool) async -> Bool {
        await setState(read ? .read : .unread)
    }

    private func setState(_ newState: CommentState) async -> Bool {
        do {
            try await service.setState(id: id, state: newState)
            if case var .loaded(comment) = state {
                comment.state = newState.rawValue
                state = .loaded(comment)
            }
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
