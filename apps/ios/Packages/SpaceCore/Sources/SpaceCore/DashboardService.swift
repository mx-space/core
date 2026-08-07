import Foundation

public struct DashboardSnapshot: Sendable, Equatable {
    public let desk: Components.Schemas.Desk
    public let stat: Components.Schemas.Stat
    public let recent: Components.Schemas.RecentActivities?
}

public struct DashboardService: Sendable {
    private let client: any APIProtocol

    public init(client: any APIProtocol) {
        self.client = client
    }

    public init(spaceClient: SpaceClient) {
        self.client = spaceClient.underlying
    }

    public func load() async throws -> DashboardSnapshot {
        async let desk = fetchDesk()
        async let stat = fetchStat()
        async let recent = try? fetchRecent()
        return try await DashboardSnapshot(desk: desk, stat: stat, recent: recent)
    }

    private func fetchDesk() async throws -> Components.Schemas.Desk {
        switch try await client.getDesk() {
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

    private func fetchStat() async throws -> Components.Schemas.Stat {
        switch try await client.getStat() {
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

    private func fetchRecent() async throws -> Components.Schemas.RecentActivities {
        switch try await client.getRecentActivities() {
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
