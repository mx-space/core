import SpaceCore
import SpaceUI
import SwiftUI
import UIKit

final class RootTabBarController: UITabBarController {
    private let client: SpaceClient
    private let pushManager: PushNotificationManager?
    private let dashboardScrollSignal = ScrollToTopSignal()

    private lazy var webCoordinator = WebHandoffCoordinator(
        service: WebHandoffService(spaceClient: client)
    )
    private lazy var commentsController = CommentsViewController(
        service: CommentService(spaceClient: client),
        openWeb: { [weak self] controller in
            self?.webCoordinator.open(.comments, from: controller)
        },
        onUnreadCountChange: { [weak self] count in
            self?.setInboxBadge(count)
        }
    )
    private lazy var recentlyController = RecentlyViewController(
        service: RecentlyService(spaceClient: client)
    )

    init(client: SpaceClient, pushManager: PushNotificationManager? = nil) {
        self.client = client
        self.pushManager = pushManager
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()

        delegate = self
        view.tintColor = SpacePalette.accent
        tabBar.tintColor = SpacePalette.accent
        tabBarMinimizeBehavior = .onScrollDown

        viewControllers = [
            wrap(
                makeDashboard(),
                title: "Today",
                systemImage: "house",
                selectedSystemImage: "house.fill",
                identifier: "tab.today"
            ),
            wrap(
                configureTopLevel(commentsController),
                title: "Inbox",
                systemImage: "tray",
                selectedSystemImage: "tray.fill",
                identifier: "tab.inbox"
            ),
            wrap(
                configureTopLevel(recentlyController),
                title: "Content",
                systemImage: "rectangle.stack",
                selectedSystemImage: "rectangle.stack.fill",
                identifier: "tab.content"
            ),
        ]
    }

    private func makeDashboard() -> UIViewController {
        let store = DashboardStore(service: DashboardService(spaceClient: client))
        let controller = UIHostingController(
            rootView: DashboardView(
                store: store,
                scrollToTopSignal: dashboardScrollSignal,
                openWeb: { [weak self] target in
                    guard let self, let presenter = selectedViewController else { return }
                    webCoordinator.open(target, from: presenter)
                },
                openMovement: { [weak self] in self?.showMovement() },
                openInbox: { [weak self] in self?.showUnreadInbox() }
            )
        )
        controller.title = "Today"
        return configureTopLevel(controller)
    }

    private func makeMovement() -> UIViewController {
        let store = MovementStore(service: MovementService(spaceClient: client))
        let controller = UIHostingController(
            rootView: MovementView(store: store)
        )
        controller.title = "Movement"
        controller.navigationItem.largeTitleDisplayMode = .never
        controller.navigationItem.rightBarButtonItem = UIBarButtonItem(
            image: UIImage(systemName: "safari"),
            primaryAction: UIAction { [weak self, weak controller] _ in
                guard let self, let controller else { return }
                webCoordinator.open(.analytics, from: controller)
            }
        )
        controller.navigationItem.rightBarButtonItem?.accessibilityLabel = "Open analytics on Web"
        return controller
    }

    private func showMovement() {
        guard let navigation = viewControllers?.first as? UINavigationController else { return }
        if navigation.topViewController is UIHostingController<MovementView> { return }
        navigation.pushViewController(makeMovement(), animated: true)
    }

    private func showUnreadInbox() {
        commentsController.focus(on: .unread)
        selectedIndex = 1
    }

    func openComment(_ id: String) {
        loadViewIfNeeded()
        selectedIndex = 1
        guard let navigation = viewControllers?[1] as? UINavigationController else { return }
        navigation.popToRootViewController(animated: false)
        commentsController.loadViewIfNeeded()
        commentsController.open(id: id)
    }

    private func configureTopLevel(_ controller: UIViewController) -> UIViewController {
        controller.navigationItem.rightBarButtonItem = siteMenu(for: controller)
        return controller
    }

    private func siteMenu(for presenter: UIViewController) -> UIBarButtonItem {
        let menu = UIMenu(children: [
            UIAction(title: "Open Web Admin", image: UIImage(systemName: "safari")) {
                [weak self, weak presenter] _ in
                guard let self, let presenter else { return }
                webCoordinator.open(.admin, from: presenter)
            },
            UIAction(title: "Site Settings", image: UIImage(systemName: "gearshape")) {
                [weak self, weak presenter] _ in
                guard let self, let presenter else { return }
                showSiteSettings(from: presenter)
            },
        ])
        let item = UIBarButtonItem(image: UIImage(systemName: "ellipsis.circle"), menu: menu)
        item.accessibilityLabel = "Site menu"
        return item
    }

    private func showSiteSettings(from presenter: UIViewController) {
        let host = client.endpoint.baseURL.host() ?? client.endpoint.baseURL.absoluteString
        let controller = UIHostingController(
            rootView: SiteSettingsView(host: host, pushManager: pushManager)
        )
        controller.hidesBottomBarWhenPushed = true
        presenter.navigationController?.pushViewController(controller, animated: true)
    }

    private func setInboxBadge(_ count: Int) {
        guard let controllers = viewControllers, controllers.indices.contains(1) else { return }
        guard let item = controllers[1].tabBarItem else { return }
        item.badgeValue = switch count {
        case ...0: nil
        case 1...99: String(count)
        default: "99+"
        }
    }

    private func wrap(
        _ controller: UIViewController,
        title: String,
        systemImage: String,
        selectedSystemImage: String,
        identifier: String
    ) -> UIViewController {
        let navigation = UINavigationController(rootViewController: controller)
        navigation.navigationBar.prefersLargeTitles = true
        navigation.tabBarItem = UITabBarItem(
            title: title,
            image: UIImage(systemName: systemImage),
            selectedImage: UIImage(systemName: selectedSystemImage)
        )
        navigation.tabBarItem.accessibilityIdentifier = identifier
        return navigation
    }
}

extension RootTabBarController: UITabBarControllerDelegate {
    func tabBarController(
        _ tabBarController: UITabBarController,
        shouldSelect viewController: UIViewController
    ) -> Bool {
        guard selectedViewController === viewController else { return true }
        guard let navigation = viewController as? UINavigationController else { return true }

        if navigation.viewControllers.count > 1 {
            navigation.popToRootViewController(animated: true)
        } else if let scrollable = navigation.topViewController as? ScrollToTopHandling {
            scrollable.scrollToTop()
        } else if viewController === viewControllers?.first {
            dashboardScrollSignal.request()
        }
        return true
    }
}
