public enum CommentState: Int, Sendable {
    case unread = 0
    case read = 1
    case junk = 2
}

extension CommentService {
    public func setState(id: String, state: CommentState) async throws {
        try await setState(id: id, state: state.rawValue)
    }
}
