import Foundation

public enum CommentFilter: String, CaseIterable, Sendable {
    case all
    case unread
    case awaiting
    case whispers
    case read
    case junk
}

public struct CommentSnapshot: Sendable, Equatable {
    public let comments: [Components.Schemas.CommentRow]
    public let counts: Components.Schemas.CommentTabCounts
}

public struct CommentService: Sendable {
    private let client: any APIProtocol

    public init(client: any APIProtocol) {
        self.client = client
    }

    public init(spaceClient: SpaceClient) {
        self.client = spaceClient.underlying
    }

    public func load(filter: CommentFilter) async throws -> CommentSnapshot {
        async let comments = list(filter: filter)
        async let counts = tabCounts()
        return try await CommentSnapshot(comments: comments, counts: counts)
    }

    public func detail(id: String) async throws -> Components.Schemas.CommentDetail {
        let input = Operations.GetComment.Input(path: .init(id: id))
        switch try await client.getComment(input) {
        case let .ok(response):
            return try response.body.json.data
        case let .clientError(status, response):
            throw SpaceError(envelope: try response.body.json, status: status)
        case let .serverError(status, response):
            throw SpaceError(envelope: try response.body.json, status: status)
        case let .undocumented(statusCode, _):
            throw SpaceError.undocumented(statusCode)
        }
    }

    public func setState(id: String, state: Int) async throws {
        let input = Operations.PatchCommentState.Input(
            path: .init(id: id),
            body: .json(.init(state: state))
        )
        switch try await client.patchCommentState(input) {
        case .noContent:
            return
        case let .clientError(status, response):
            throw SpaceError(envelope: try response.body.json, status: status)
        case let .serverError(status, response):
            throw SpaceError(envelope: try response.body.json, status: status)
        case let .undocumented(statusCode, _):
            throw SpaceError.undocumented(statusCode)
        }
    }

    public func delete(id: String) async throws {
        let input = Operations.DeleteComment.Input(path: .init(id: id))
        switch try await client.deleteComment(input) {
        case .noContent:
            return
        case let .clientError(status, response):
            throw SpaceError(envelope: try response.body.json, status: status)
        case let .serverError(status, response):
            throw SpaceError(envelope: try response.body.json, status: status)
        case let .undocumented(statusCode, _):
            throw SpaceError.undocumented(statusCode)
        }
    }

    public func reply(id: String, text: String) async throws -> Components.Schemas.CommentDetail {
        let input = Operations.ReplyAsOwner.Input(
            path: .init(id: id),
            body: .json(.init(text: text))
        )
        switch try await client.replyAsOwner(input) {
        case let .created(response):
            return try response.body.json.data
        case let .clientError(status, response):
            throw SpaceError(envelope: try response.body.json, status: status)
        case let .serverError(status, response):
            throw SpaceError(envelope: try response.body.json, status: status)
        case let .undocumented(statusCode, _):
            throw SpaceError.undocumented(statusCode)
        }
    }

    private func list(filter: CommentFilter) async throws -> [Components.Schemas.CommentRow] {
        let tab: Operations.ListComments.Input.Query.TabPayload = switch filter {
        case .all: .all
        case .unread: .unread
        case .awaiting: .awaiting
        case .whispers: .whispers
        case .read: .read
        case .junk: .junk
        }
        let input = Operations.ListComments.Input(query: .init(page: 1, size: 50, tab: tab))
        switch try await client.listComments(input) {
        case let .ok(response):
            return try response.body.json.data
        case let .clientError(status, response):
            throw SpaceError(envelope: try response.body.json, status: status)
        case let .serverError(status, response):
            throw SpaceError(envelope: try response.body.json, status: status)
        case let .undocumented(statusCode, _):
            throw SpaceError.undocumented(statusCode)
        }
    }

    private func tabCounts() async throws -> Components.Schemas.CommentTabCounts {
        switch try await client.getCommentTabCounts() {
        case let .ok(response):
            return try response.body.json.data
        case let .clientError(status, response):
            throw SpaceError(envelope: try response.body.json, status: status)
        case let .serverError(status, response):
            throw SpaceError(envelope: try response.body.json, status: status)
        case let .undocumented(statusCode, _):
            throw SpaceError.undocumented(statusCode)
        }
    }
}
