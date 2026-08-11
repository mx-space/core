import SpaceCore
import SpaceUI
import SwiftUI
import UIKit

final class RecentlyViewController: UIViewController {
    private enum Section {
        case feed
    }

    private let store: RecentlyStore
    private let service: RecentlyService

    private lazy var composerStore = RecentlyComposerStore(
        service: service,
        contentStore: store,
        onSaved: { [weak self] in self?.applySnapshot() }
    )
    private var composerController: UIHostingController<RecentlyInlineComposerView>!
    private var composerPanelController: UIHostingController<RecentlyComposerPanelView>!
    private var collectionView: UICollectionView!
    private var dataSource: UICollectionViewDiffableDataSource<Section, String>!
    private let refreshControl = UIRefreshControl()

    init(service: RecentlyService) {
        self.service = service
        store = RecentlyStore(service: service)
        super.init(nibName: nil, bundle: nil)
        title = "Recently"
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = SpacePalette.page
        navigationItem.largeTitleDisplayMode = .always
        view.keyboardLayoutGuide.followsUndockedKeyboard = true

        configureComposer()
        configureCollectionView()
        Task { await reload() }
    }

    private func configureComposer() {
        let controller = UIHostingController(
            rootView: RecentlyInlineComposerView(store: composerStore)
        )
        controller.sizingOptions = .intrinsicContentSize
        controller.view.backgroundColor = .clear
        controller.view.setContentCompressionResistancePriority(.required, for: .vertical)

        addChild(controller)
        view.addSubview(controller.view)
        controller.view.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            controller.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            controller.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            controller.view.bottomAnchor.constraint(equalTo: view.keyboardLayoutGuide.topAnchor),
        ])
        controller.didMove(toParent: self)
        composerController = controller

        let panelController = UIHostingController(
            rootView: RecentlyComposerPanelView(store: composerStore)
        )
        panelController.sizingOptions = .intrinsicContentSize
        panelController.view.backgroundColor = .clear
        panelController.view.setContentCompressionResistancePriority(.required, for: .vertical)

        addChild(panelController)
        view.addSubview(panelController.view)
        panelController.view.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            panelController.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            panelController.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            panelController.view.bottomAnchor.constraint(equalTo: controller.view.topAnchor),
        ])
        panelController.didMove(toParent: self)
        composerPanelController = panelController
    }

    private func configureCollectionView() {
        var configuration = UICollectionLayoutListConfiguration(appearance: .plain)
        configuration.backgroundColor = SpacePalette.page
        configuration.headerMode = .none
        configuration.showsSeparators = true

        collectionView = UICollectionView(
            frame: .zero,
            collectionViewLayout: UICollectionViewCompositionalLayout.list(using: configuration)
        )
        collectionView.backgroundColor = SpacePalette.page
        collectionView.keyboardDismissMode = .interactive
        collectionView.accessibilityIdentifier = "recently.list"
        collectionView.delegate = self
        collectionView.refreshControl = refreshControl
        refreshControl.addAction(
            UIAction { [weak self] _ in Task { await self?.reload() } },
            for: .valueChanged
        )
        view.insertSubview(collectionView, belowSubview: composerController.view)
        collectionView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            collectionView.topAnchor.constraint(equalTo: view.topAnchor),
            collectionView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            collectionView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            collectionView.bottomAnchor.constraint(equalTo: composerController.view.topAnchor),
        ])

        view.bringSubviewToFront(composerPanelController.view)
        view.bringSubviewToFront(composerController.view)

        let registration = UICollectionView.CellRegistration<UICollectionViewListCell, RecentlyCard> {
            [weak self] cell, _, entry in
            cell.contentConfiguration = UIHostingConfiguration {
                RecentlyRowView(
                    entry: entry,
                    onEdit: { [weak self] in self?.edit(entry) },
                    onDelete: { [weak self] in self?.confirmDeletion(of: entry.id) }
                )
            }
            .margins(.horizontal, Spacing.regular)
            .margins(.vertical, 0)
            cell.backgroundConfiguration = UIBackgroundConfiguration.clear()
            cell.accessibilityIdentifier = "recently.row.\(entry.id)"
            cell.directionalLayoutMargins = NSDirectionalEdgeInsets(
                top: 0,
                leading: Spacing.regular,
                bottom: 0,
                trailing: Spacing.regular
            )
        }

        dataSource = UICollectionViewDiffableDataSource(
            collectionView: collectionView
        ) { [weak self] collectionView, indexPath, id in
            guard let entry = self?.store.entries.first(where: { $0.id == id }) else { return nil }
            return collectionView.dequeueConfiguredReusableCell(
                using: registration,
                for: indexPath,
                item: entry
            )
        }
    }

    @MainActor
    private func reload() async {
        await store.reload()
        refreshControl.endRefreshing()
        applySnapshot()
    }

    @MainActor
    private func applySnapshot() {
        var snapshot = NSDiffableDataSourceSnapshot<Section, String>()
        if !store.entries.isEmpty {
            snapshot.appendSections([.feed])
            snapshot.appendItems(store.entries.map(\.id), toSection: .feed)
            snapshot.reconfigureItems(snapshot.itemIdentifiers)
        }
        dataSource.apply(snapshot, animatingDifferences: true)
        updateEmptyState()
    }

    private func updateEmptyState() {
        guard store.entries.isEmpty else {
            collectionView.backgroundView = nil
            return
        }

        if store.isLoading {
            var configuration = UIContentUnavailableConfiguration.loading()
            configuration.text = "Loading Recently"
            collectionView.backgroundView = UIContentUnavailableView(configuration: configuration)
            return
        }

        var configuration = UIContentUnavailableConfiguration.empty()
        if store.errorMessage != nil {
            configuration.image = UIImage(systemName: "exclamationmark.triangle")
            configuration.text = "Could not load Recently"
            configuration.secondaryText = "Check the Space server connection, then try again."
            var retry = UIButton.Configuration.glass()
            retry.title = "Retry"
            retry.cornerStyle = .capsule
            configuration.button = retry
            configuration.buttonProperties.primaryAction = UIAction { [weak self] _ in
                Task { await self?.reload() }
            }
        } else {
            configuration.image = UIImage(systemName: "text.bubble")
            configuration.text = "No Recently entries yet"
            configuration.secondaryText = "Publish a short update from the field below."
            var create = UIButton.Configuration.prominentGlass()
            create.title = "Write an update"
            create.cornerStyle = .capsule
            configuration.button = create
            configuration.buttonProperties.primaryAction = UIAction { [weak self] _ in
                self?.composerStore.focusInput()
            }
        }
        collectionView.backgroundView = UIContentUnavailableView(configuration: configuration)
    }

    private func edit(_ entry: RecentlyCard) {
        composerStore.beginEditing(entry)
    }

    private func confirmDeletion(of id: String) {
        let alert = UIAlertController(
            title: "Delete this Recently entry?",
            message: "This action cannot be undone.",
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        alert.addAction(UIAlertAction(title: "Delete", style: .destructive) { [weak self] _ in
            guard let self else { return }
            Task { @MainActor in
                await store.delete(id: id)
                applySnapshot()
            }
        })
        present(alert, animated: true)
    }
}

extension RecentlyViewController: UICollectionViewDelegate {
    func collectionView(
        _ collectionView: UICollectionView,
        willDisplay cell: UICollectionViewCell,
        forItemAt indexPath: IndexPath
    ) {
        guard dataSource.itemIdentifier(for: indexPath) == store.entries.last?.id else { return }
        Task { @MainActor in
            await store.loadMore()
            applySnapshot()
        }
    }
}

extension RecentlyViewController: ScrollToTopHandling {
    func scrollToTop() {
        guard collectionView.numberOfSections > 0 else { return }
        collectionView.setContentOffset(
            CGPoint(x: 0, y: -collectionView.adjustedContentInset.top),
            animated: true
        )
    }
}
