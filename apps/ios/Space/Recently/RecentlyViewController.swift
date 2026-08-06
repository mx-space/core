import SpaceCore
import SpaceUI
import SwiftUI
import UIKit

final class RecentlyViewController: UIViewController {
    private enum Section { case main }

    private let store: RecentlyStore
    private let service: RecentlyService
    private let openWeb: (UIViewController) -> Void

    private var collectionView: UICollectionView!
    private var dataSource: UICollectionViewDiffableDataSource<Section, String>!
    private let refreshControl = UIRefreshControl()
    private var observation: NSKeyValueObservation?

    init(service: RecentlyService, openWeb: @escaping (UIViewController) -> Void) {
        self.service = service
        self.store = RecentlyStore(service: service)
        self.openWeb = openWeb
        super.init(nibName: nil, bundle: nil)
        title = "Recently"
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        navigationItem.largeTitleDisplayMode = .always
        navigationItem.rightBarButtonItem = UIBarButtonItem(
            systemItem: .compose,
            primaryAction: UIAction { [weak self] _ in self?.presentComposer() }
        )
        navigationItem.rightBarButtonItem?.accessibilityIdentifier = "recently.compose"
        navigationItem.leftBarButtonItem = UIBarButtonItem(
            image: UIImage(systemName: "safari"),
            primaryAction: UIAction { [weak self] _ in
                guard let self else { return }
                self.openWeb(self)
            }
        )
        navigationItem.leftBarButtonItem?.accessibilityLabel = "Open Recently on Web"

        configureCollectionView()
        Task { await reload() }
    }

    private func configureCollectionView() {
        var configuration = UICollectionLayoutListConfiguration(appearance: .insetGrouped)
        configuration.trailingSwipeActionsConfigurationProvider = { [weak self] indexPath in
            guard let self, let id = dataSource.itemIdentifier(for: indexPath) else { return nil }
            let delete = UIContextualAction(style: .destructive, title: "Delete") { _, _, done in
                Task { @MainActor in
                    await self.store.delete(id: id)
                    self.applySnapshot()
                    done(true)
                }
            }
            return UISwipeActionsConfiguration(actions: [delete])
        }

        collectionView = UICollectionView(
            frame: view.bounds,
            collectionViewLayout: UICollectionViewCompositionalLayout.list(using: configuration)
        )
        collectionView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        collectionView.accessibilityIdentifier = "recently.list"
        collectionView.delegate = self
        collectionView.refreshControl = refreshControl
        refreshControl.addAction(
            UIAction { [weak self] _ in Task { await self?.reload() } },
            for: .valueChanged
        )
        view.addSubview(collectionView)

        let registration = UICollectionView.CellRegistration<
            UICollectionViewListCell, RecentlyCard
        > { cell, _, entry in
            cell.contentConfiguration = UIHostingConfiguration {
                RecentlyRowView(entry: entry)
            }
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
        showErrorIfNeeded()
    }

    @MainActor
    private func applySnapshot() {
        var snapshot = NSDiffableDataSourceSnapshot<Section, String>()
        snapshot.appendSections([.main])
        snapshot.appendItems(store.entries.map(\.id))
        dataSource.apply(snapshot, animatingDifferences: true)
    }

    @MainActor
    private func showErrorIfNeeded() {
        guard let message = store.errorMessage else { return }
        let alert = UIAlertController(title: "Recently", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }

    private func presentComposer() {
        presentComposer(entry: nil)
    }

    private func presentComposer(entry: RecentlyCard?) {
        let composer = RecentlyComposerView(
            service: service,
            initialText: entry?.content ?? "",
            navigationTitle: entry == nil ? "New Recently" : "Edit Recently"
        ) { [weak self] content in
            guard let self else { return "Composer lost its list" }
            let failure = await store.save(id: entry?.id, content: content)
            if failure == nil { applySnapshot() }
            return failure
        }
        present(UIHostingController(rootView: composer), animated: true)
    }
}

extension RecentlyViewController: UICollectionViewDelegate {
    func collectionView(_ collectionView: UICollectionView, didSelectItemAt indexPath: IndexPath) {
        collectionView.deselectItem(at: indexPath, animated: true)
        guard
            let id = dataSource.itemIdentifier(for: indexPath),
            let entry = store.entries.first(where: { $0.id == id })
        else { return }
        presentComposer(entry: entry)
    }
}
