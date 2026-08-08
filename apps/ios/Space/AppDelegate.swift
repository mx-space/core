import UIKit
import UserNotifications

private struct NotificationResponseCompletion: @unchecked Sendable {
    let call: () -> Void
}

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        let center = UNUserNotificationCenter.current()
        center.delegate = self
        center.setNotificationCategories([
            UNNotificationCategory(
                identifier: "SPACE_COMMENT",
                actions: [],
                intentIdentifiers: []
            ),
        ])
        // UI tests launch with `-space.resetPairing YES` so each run starts
        // from the unpaired state rather than inheriting a previous keychain.
        if UserDefaults.standard.bool(forKey: "space.resetPairing") {
            AppContainer.shared.clearPairing()
        }
        return true
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        AppContainer.shared.didRegisterForRemoteNotifications(deviceToken)
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        AppContainer.shared.didFailToRegisterForRemoteNotifications(error)
    }

    func application(
        _ application: UIApplication,
        configurationForConnecting connectingSceneSession: UISceneSession,
        options: UIScene.ConnectionOptions
    ) -> UISceneConfiguration {
        UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }
}

extension AppDelegate: UNUserNotificationCenterDelegate {
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .list, .sound]
    }

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let payload = response.notification.request.content.userInfo
        let resourceID: String?
        if
            (payload["schema_version"] as? NSNumber)?.intValue == 1,
            payload["resource_type"] as? String == "comment"
        {
            resourceID = switch payload["resource_id"] {
            case let value as String where !value.isEmpty:
                value
            case let value as NSNumber:
                value.stringValue
            default:
                nil
            }
        } else {
            resourceID = nil
        }

        let completion = NotificationResponseCompletion(call: completionHandler)
        Task { @MainActor in
            if let resourceID {
                AppContainer.shared.openComment(resourceID)
            }
            completion.call()
        }
    }
}
