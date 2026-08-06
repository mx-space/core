import SpaceCore
import SpaceUI
import SwiftUI
import UIKit

final class RootTabBarController: UITabBarController {
    private let client: SpaceClient
    private lazy var webCoordinator = WebHandoffCoordinator(
        service: WebHandoffService(spaceClient: client)
    )

    init(client: SpaceClient) {
        self.client = client
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
                title: "Dashboard",
                systemImage: "square.grid.2x2",
                identifier: "tab.dashboard"
            ),
            wrap(
                makeMovement(),
                title: "Movement",
                systemImage: "waveform.path.ecg",
                identifier: "tab.movement"
            ),
            wrap(
                RecentlyViewController(
                    service: RecentlyService(spaceClient: client),
                    openWeb: { [weak self] controller in
                        self?.webCoordinator.open(.recently, from: controller)
                    }
                ),
                title: "Recently",
                systemImage: "text.bubble",
                identifier: "tab.recently"
            ),
            wrap(
                CommentsViewController(
                    service: CommentService(spaceClient: client),
                    openWeb: { [weak self] controller in
                        self?.webCoordinator.open(.comments, from: controller)
                    }
                ),
                title: "Comments",
                systemImage: "bubble.left.and.bubble.right",
                identifier: "tab.comments"
            ),
        ]
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
                selectTab: { [weak self] index in self?.selectedIndex = index }
            )
        )
        controller.title = "Dashboard"
        controller.navigationItem.rightBarButtonItem = siteMenu(for: controller)
        return controller
    }

    private func makeMovement() -> UIViewController {
        let store = MovementStore(service: MovementService(spaceClient: client))
        let controller = UIHostingController(
            rootView: MovementView(store: store) { [weak self] in
                guard let self, let presenter = self.selectedViewController else { return }
                self.webCoordinator.open(.analytics, from: presenter)
            }
        )
        controller.title = "Movement"
        controller.navigationItem.rightBarButtonItem = siteMenu(for: controller)
        return controller
    }

    private func siteMenu(for presenter: UIViewController) -> UIBarButtonItem {
        let menu = UIMenu(children: [
            UIAction(title: "Open Web Admin", image: UIImage(systemName: "safari")) {
                [weak self, weak presenter] _ in
                guard let self, let presenter else { return }
                self.webCoordinator.open(.admin, from: presenter)
            },
            UIAction(
                title: "Unpair",
                image: UIImage(systemName: "rectangle.portrait.and.arrow.right"),
                attributes: .destructive
            ) { _ in AppContainer.shared.unpair() },
        ])
        let item = UIBarButtonItem(image: UIImage(systemName: "ellipsis.circle"), menu: menu)
        item.accessibilityLabel = "Site menu"
        return item
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
