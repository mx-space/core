import Observation
import SpaceCore
import UIKit
import UserNotifications

@MainActor
@Observable
final class PushNotificationManager {
    enum State: Equatable {
        case idle
        case enabling
        case enabled
        case disabling
        case failed(String)
    }

    private(set) var state: State = .idle
    private(set) var bindingID: String?
    private(set) var authorizationStatus: UNAuthorizationStatus = .notDetermined

    private let configuration: PushConfiguration
    private let relay: PushRelayClient
    private let activation: PushActivationService
    private let credentials: any PushCredentialStore

    var isEnabled: Bool { state == .enabled }
    var isWorking: Bool { state == .enabling || state == .disabling }
    var isDenied: Bool { authorizationStatus == .denied }
    var errorMessage: String? {
        guard case let .failed(message) = state else { return nil }
        return message
    }

    init(
        configuration: PushConfiguration,
        client: SpaceClient,
        credentials: any PushCredentialStore = KeychainPushCredentialStore()
    ) {
        self.configuration = configuration
        relay = PushRelayClient(configuration: configuration)
        activation = PushActivationService(spaceClient: client)
        self.credentials = credentials
    }

    func refresh() async {
        authorizationStatus = await UNUserNotificationCenter.current()
            .notificationSettings().authorizationStatus
        do {
            guard
                let credential = try credentials.read(),
                let storedBindingID = credential.bindingID
            else {
                bindingID = nil
                state = .idle
                return
            }
            let binding = try await relay.binding(
                bindingID: storedBindingID,
                credential: credential
            )
            bindingID = binding.bindingID
            state = .enabled
        } catch PushRelayError.rejected(404) {
            try? credentials.clear()
            bindingID = nil
            state = .idle
        } catch {
            state = .failed(error.localizedDescription)
        }
    }

    func enable() async {
        guard !isWorking else { return }
        state = .enabling
        do {
            let center = UNUserNotificationCenter.current()
            let settings = await center.notificationSettings()
            authorizationStatus = settings.authorizationStatus
            switch settings.authorizationStatus {
            case .notDetermined:
                guard try await center.requestAuthorization(options: [.alert, .sound]) else {
                    authorizationStatus = .denied
                    state = .failed("Notifications were not allowed.")
                    return
                }
                authorizationStatus = await center.notificationSettings().authorizationStatus
            case .denied:
                state = .failed("Notifications are disabled in iOS Settings.")
                return
            case .authorized, .provisional, .ephemeral:
                break
            @unknown default:
                state = .failed("The notification authorization state is unavailable.")
                return
            }
            UIApplication.shared.registerForRemoteNotifications()
        } catch {
            state = .failed(error.localizedDescription)
        }
    }

    func restoreRegistration() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        authorizationStatus = settings.authorizationStatus
        guard
            settings.authorizationStatus == .authorized ||
            settings.authorizationStatus == .provisional ||
            settings.authorizationStatus == .ephemeral,
            (try? credentials.read()) != nil
        else { return }
        UIApplication.shared.registerForRemoteNotifications()
    }

    func didRegister(deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        Task { await activate(deviceToken: token) }
    }

    func didFailRegistration(_ error: Error) {
        state = .failed(error.localizedDescription)
    }

    func disable() async {
        guard
            let bindingID,
            let credential = try? credentials.read(),
            !isWorking
        else { return }
        state = .disabling
        do {
            try await relay.revokeBinding(
                bindingID: bindingID,
                credential: credential
            )
            try credentials.clear()
            self.bindingID = nil
            state = .idle
        } catch {
            state = .failed(error.localizedDescription)
        }
    }

    func openSystemSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
        UIApplication.shared.open(url)
    }

    private func activate(deviceToken: String) async {
        state = .enabling
        do {
            let credential: PushInstallationCredential
            if let current = try credentials.read() {
                do {
                    try await relay.update(deviceToken: deviceToken, credential: current)
                    credential = current
                } catch PushRelayError.rejected(401) {
                    try credentials.clear()
                    credential = try await relay.register(deviceToken: deviceToken)
                    try credentials.write(credential)
                }
            } else {
                credential = try await relay.register(deviceToken: deviceToken)
                try credentials.write(credential)
            }

            let ticket = try await relay.activationTicket(credential: credential)
            let status = try await activation.activate(
                relayURL: configuration.relayURL,
                ticket: ticket.ticket
            )
            let activatedCredential = PushInstallationCredential(
                installationID: credential.installationID,
                installationSecret: credential.installationSecret,
                bindingID: status.bindingID
            )
            try credentials.write(activatedCredential)
            bindingID = status.bindingID
            state = .enabled
        } catch {
            state = .failed(error.localizedDescription)
        }
    }
}
