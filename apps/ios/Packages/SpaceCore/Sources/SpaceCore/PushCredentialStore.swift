import Foundation

public struct PushInstallationCredential: Codable, Sendable, Equatable {
    public let installationID: String
    public let installationSecret: String
    public let bindingID: String?

    public init(
        installationID: String,
        installationSecret: String,
        bindingID: String? = nil
    ) {
        self.installationID = installationID
        self.installationSecret = installationSecret
        self.bindingID = bindingID
    }
}

public protocol PushCredentialStore: Sendable {
    func read() throws -> PushInstallationCredential?
    func write(_ credential: PushInstallationCredential) throws
    func clear() throws
}

public struct KeychainPushCredentialStore: PushCredentialStore {
    private let storage: KeychainTokenStore

    public init(service: String = "dev.innei.space.push-installation") {
        storage = KeychainTokenStore(service: service, account: "default")
    }

    public func read() throws -> PushInstallationCredential? {
        guard let value = try storage.read(), let data = value.data(using: .utf8) else { return nil }
        return try JSONDecoder().decode(PushInstallationCredential.self, from: data)
    }

    public func write(_ credential: PushInstallationCredential) throws {
        let data = try JSONEncoder().encode(credential)
        guard let value = String(data: data, encoding: .utf8) else {
            throw KeychainTokenStore.Failure.malformedData
        }
        try storage.write(value)
    }

    public func clear() throws {
        try storage.clear()
    }
}

public final class InMemoryPushCredentialStore: PushCredentialStore, @unchecked Sendable {
    private let lock = NSLock()
    private var credential: PushInstallationCredential?

    public init(credential: PushInstallationCredential? = nil) {
        self.credential = credential
    }

    public func read() throws -> PushInstallationCredential? {
        lock.withLock { credential }
    }

    public func write(_ credential: PushInstallationCredential) throws {
        lock.withLock { self.credential = credential }
    }

    public func clear() throws {
        lock.withLock { credential = nil }
    }
}
