import SpaceCore
import SpaceUI
import SwiftUI
import UIKit

final class RootTabBarController: UITabBarController {
    private let client: SpaceClient
    private let pushManager: PushNotificationManager?
    private lazy var webCoordinator = WebHandoffCoordinator(
        service: WebHandoffService(spaceClient: client)
    )
    private lazy var commentsController = CommentsViewController(
        service: CommentService(spaceClient: client),
        openWeb: { [weak self] controller in
            self?.webCoordinator.open(.comments, from: controller)
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

        tabBarMinimizeBehavior = .onScrollDown

        viewControllers = [
            wrap(
                makeDashboard(),
                title: "Today",
                systemImage: "sun.max",
                identifier: "tab.today"
            ),
            wrap(
                configureTopLevel(commentsController),
                title: "Inbox",
                systemImage: "tray",
                identifier: "tab.inbox"
            ),
            wrap(
                configureTopLevel(recentlyController),
                title: "Content",
                systemImage: "rectangle.stack",
                identifier: "tab.content"
            ),
        ]

        installCreateAccessory()
    }

    private func makeDashboard() -> UIViewController {
        let store = DashboardStore(service: DashboardService(spaceClient: client))
        let controller = UIHostingController(
            rootView: DashboardView(
                store: store,
                openWeb: { [weak self] target in
                    guard let self, let presenter = self.selectedViewController else { return }
                    self.webCoordinator.open(target, from: presenter)
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
            rootView: MovementView(store: store) { [weak self] in
                guard
                    let self,
                    let navigation = self.viewControllers?.first as? UINavigationController,
                    let presenter = navigation.visibleViewController
                else { return }
                self.webCoordinator.open(.analytics, from: presenter)
            }
        )
        controller.title = "Movement"
        controller.navigationItem.largeTitleDisplayMode = .never
        controller.navigationItem.rightBarButtonItem = UIBarButtonItem(
            image: UIImage(systemName: "safari"),
            primaryAction: UIAction { [weak self, weak controller] _ in
                guard let self, let controller else { return }
                self.webCoordinator.open(.analytics, from: controller)
            }
        )
        controller.navigationItem.rightBarButtonItem?.accessibilityLabel = "Open analytics on Web"
        return controller
    }

    private func showMovement() {
        guard let navigation = viewControllers?.first as? UINavigationController else { return }
        if navigation.topViewController?.title == "Movement" { return }
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

    private func installCreateAccessory() {
        let button = UIButton(configuration: .borderedProminent())
        button.configuration?.image = UIImage(systemName: "plus")
        button.configuration?.cornerStyle = .capsule
        button.accessibilityLabel = "New Recently"
        button.accessibilityIdentifier = "global.compose"
        button.addAction(
            UIAction { [weak self] _ in self?.presentGlobalComposer() },
            for: .touchUpInside
        )

        let container = UIView()
        container.addSubview(button)
        button.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            button.widthAnchor.constraint(equalToConstant: 52),
            button.heightAnchor.constraint(equalToConstant: 44),
            button.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: Spacing.tight),
            button.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -Spacing.tight),
            button.topAnchor.constraint(equalTo: container.topAnchor, constant: Spacing.tight),
            button.bottomAnchor.constraint(equalTo: container.bottomAnchor, constant: -Spacing.tight),
        ])
        bottomAccessory = UITabAccessory(contentView: container)
    }

    private func presentGlobalComposer() {
        guard let presenter = selectedViewController else { return }
        recentlyController.presentComposer(from: presenter) { [weak self] in
            self?.selectedIndex = 2
        }
    }

    private func siteMenu(for presenter: UIViewController) -> UIBarButtonItem {
        var actions: [UIMenuElement] = [
            UIAction(title: "Open Web Admin", image: UIImage(systemName: "safari")) {
                [weak self, weak presenter] _ in
                guard let self, let presenter else { return }
                self.webCoordinator.open(.admin, from: presenter)
            },
        ]
        if pushManager != nil {
            actions.append(
                UIAction(title: "Notifications", image: UIImage(systemName: "bell")) {
                    [weak self, weak presenter] _ in
                    guard let self, let presenter else { return }
                    self.showNotificationSettings(from: presenter)
                }
            )
        }
        actions.append(
            UIAction(
                title: "Unpair",
                image: UIImage(systemName: "rectangle.portrait.and.arrow.right"),
                attributes: .destructive
            ) { _ in AppContainer.shared.unpair() }
        )
        let menu = UIMenu(children: actions)
        let item = UIBarButtonItem(image: UIImage(systemName: "ellipsis.circle"), menu: menu)
        item.accessibilityLabel = "Site menu"
        return item
    }

    private func showNotificationSettings(from presenter: UIViewController) {
        guard let pushManager else { return }
        let controller = UIHostingController(
            rootView: NotificationSettingsView(manager: pushManager)
        )
        presenter.navigationController?.pushViewController(controller, animated: true)
    }

    private func wrap(
        _ controller: UIViewController,
        title: String,
        systemImage: String,
        identifier: String
    ) -> UIViewController {
        let navigation = UINavigationController(rootViewController: controller)
        navigation.navigationBar.prefersLargeTitles = true
        navigation.tabBarItem = UITabBarItem(
            title: title,
            image: UIImage(systemName: systemImage),
            selectedImage: nil
        )
        navigation.tabBarItem.accessibilityIdentifier = identifier
        return navigation
    }
}
