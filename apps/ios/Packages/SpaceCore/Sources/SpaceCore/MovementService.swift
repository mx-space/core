import Foundation

public struct MovementSnapshot: Sendable, Equatable {
    public let aggregate: Components.Schemas.AnalyzeAggregate
    public let topReadings: [Components.Schemas.ReadingRank]
    public let recent: Components.Schemas.RecentActivities
}

public struct MovementService: Sendable {
    private let client: any APIProtocol

    public init(client: any APIProtocol) {
        self.client = client
    }

    public init(spaceClient: SpaceClient) {
        self.client = spaceClient.underlying
    }

    public func load(days: Int = 14) async throws -> MovementSnapshot {
        async let aggregate = fetchAggregate()
        async let topReadings = fetchTopReadings(days: days)
        async let recent = fetchRecent()
        return try await MovementSnapshot(
            aggregate: aggregate,
            topReadings: topReadings,
            recent: recent
        )
    }

    private func fetchAggregate() async throws -> Components.Schemas.AnalyzeAggregate {
        switch try await client.getAnalyzeAggregate() {
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

    private func fetchTopReadings(days: Int) async throws -> [Components.Schemas.ReadingRank] {
        let input = Operations.GetTopReadings.Input(
            query: .init(top: 5, days: days)
        )
        switch try await client.getTopReadings(input) {
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
