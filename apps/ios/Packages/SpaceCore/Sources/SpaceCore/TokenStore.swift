import Foundation
import Security

public protocol TokenStore: Sendable {
    func read() throws -> String?
    func write(_ token: String) throws
    func clear() throws
}

public struct KeychainTokenStore: TokenStore {
    public enum Failure: Error, Sendable, Equatable {
        case unexpectedStatus(OSStatus)
        case malformedData
    }

    private let service: String
    private let account: String

    public init(service: String = "dev.innei.space.session", account: String = "default") {
        self.service = service
        self.account = account
    }

    private var baseQuery: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }

    public func read() throws -> String? {
        var query = baseQuery
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess else { throw Failure.unexpectedStatus(status) }
        guard let data = item as? Data, let token = String(data: data, encoding: .utf8) else {
            throw Failure.malformedData
        }
        return token
    }

    public func write(_ token: String) throws {
        guard let data = token.data(using: .utf8) else { throw Failure.malformedData }

        // Background refresh reads the token after first unlock, so the item
        // must survive a locked device without syncing to other devices.
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]

        let updateStatus = SecItemUpdate(baseQuery as CFDictionary, attributes as CFDictionary)
        if updateStatus == errSecSuccess { return }
        guard updateStatus == errSecItemNotFound else {
            throw Failure.unexpectedStatus(updateStatus)
        }

        let addStatus = SecItemAdd(baseQuery.merging(attributes) { _, new in new } as CFDictionary, nil)
        guard addStatus == errSecSuccess else { throw Failure.unexpectedStatus(addStatus) }
    }

    public func clear() throws {
        let status = SecItemDelete(baseQuery as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw Failure.unexpectedStatus(status)
        }
    }
}

public final class InMemoryTokenStore: TokenStore, @unchecked Sendable {
    private let lock = NSLock()
    private var token: String?

    public init(token: String? = nil) {
        self.token = token
    }

    public func read() throws -> String? {
        lock.withLock { token }
    }

    public func write(_ token: String) throws {
        lock.withLock { self.token = token }
    }

    public func clear() throws {
        lock.withLock { self.token = nil }
    }
}
