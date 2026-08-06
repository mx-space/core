import SpaceCore
import SpaceUI
import SwiftUI
import UIKit

final class RootTabBarController: UITabBarController {
    private let client: SpaceClient

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
                RecentlyViewController(service: RecentlyService(spaceClient: client)),
                title: "Recently",
                systemImage: "text.bubble",
                identifier: "tab.recently"
            ),
            wrap(
                PlaceholderViewController(title: "Comments"),
                title: "Comments",
                systemImage: "bubble.left.and.bubble.right",
                identifier: "tab.comments"
            ),
            wrap(
                PlaceholderViewController(title: "Files"),
                title: "Files",
                systemImage: "folder",
                identifier: "tab.files"
            ),
        ]
    }

    private func makeDashboard() -> UIViewController {
        let store = DashboardStore(service: DashboardService(spaceClient: client))
        let controller = UIHostingController(rootView: DashboardView(store: store))
        controller.title = "Dashboard"
        controller.navigationItem.rightBarButtonItem = UIBarButtonItem(
            title: "Unpair",
            primaryAction: UIAction { _ in AppContainer.shared.unpair() }
        )
        return controller
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

final class PlaceholderViewController: UIViewController {
    init(title: String) {
        super.init(nibName: nil, bundle: nil)
        self.title = title
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        navigationItem.largeTitleDisplayMode = .always
    }
}
