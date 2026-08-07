import SpaceCore
import UIKit

/// Composition root. Feature screens never construct their own dependencies;
/// the app target owns every wire so the packages stay independently testable.
@MainActor
final class AppContainer {
    static let shared = AppContainer()

    let tokenStore: any TokenStore = KeychainTokenStore()
    let serverStore = ServerStore()

    private var pushManager: PushNotificationManager?
    private var pendingCommentID: String?

    private init() {}

    private var pairedEndpoint: ServerEndpoint? {
        let hasToken = ((try? tokenStore.read()) ?? nil)?.isEmpty == false
        return hasToken ? serverStore.read() : nil
    }

    func makeRootViewController() -> UIViewController {
        if let endpoint = pairedEndpoint {
            let client = makeClient(endpoint)
            let manager = PushConfigurationLoader.bundled().map {
                PushNotificationManager(configuration: $0, client: client)
            }
            pushManager = manager
            let root = RootTabBarController(client: client, pushManager: manager)
            if let pendingCommentID {
                self.pendingCommentID = nil
                Task { @MainActor in
                    root.loadViewIfNeeded()
                    root.openComment(pendingCommentID)
                }
            }
            if let manager {
                Task { await manager.restoreRegistration() }
            }
            return root
        } else {
            pushManager = nil
            return makePairingFlow()
        }
    }

    func makeClient(_ endpoint: ServerEndpoint) -> SpaceClient {
        SpaceClient(endpoint: endpoint, tokenStore: tokenStore)
    }

    func makePairingFlow() -> UIViewController {
        let setup = ServerSetupViewController { [weak self] endpoint in
            self?.presentPairing(for: endpoint)
        }
        return UINavigationController(rootViewController: setup)
    }

    private func presentPairing(for endpoint: ServerEndpoint) {
        guard let navigation = rootNavigationController else { return }
        let client = makeClient(endpoint)
        let controller = PairingCodeViewController(
            endpoint: endpoint,
            pairing: PairingService(spaceClient: client, tokenStore: tokenStore)
        ) { [weak self] in
            self?.serverStore.write(endpoint)
            self?.swapRoot()
        }
        navigation.pushViewController(controller, animated: true)
    }

    private var rootNavigationController: UINavigationController? {
        keyWindow?.rootViewController as? UINavigationController
    }

    private var keyWindow: UIWindow? {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first { $0.isKeyWindow }
    }

    func swapRoot() {
        guard let window = keyWindow else { return }
        let replacement = makeRootViewController()
        UIView.transition(with: window, duration: 0.3, options: .transitionCrossDissolve) {
            window.rootViewController = replacement
        }
    }

    func clearPairing() {
        try? tokenStore.clear()
        serverStore.clear()
        pushManager = nil
    }

    func unpair() {
        clearPairing()
        swapRoot()
    }

    func didRegisterForRemoteNotifications(_ deviceToken: Data) {
        pushManager?.didRegister(deviceToken: deviceToken)
    }

    func didFailToRegisterForRemoteNotifications(_ error: Error) {
        pushManager?.didFailRegistration(error)
    }

    func openComment(_ id: String) {
        guard let root = keyWindow?.rootViewController as? RootTabBarController else {
            pendingCommentID = id
            return
        }
        root.openComment(id)
    }
}
