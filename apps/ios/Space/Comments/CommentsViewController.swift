import SpaceCore
import SwiftUI
import UIKit

final class CommentsViewController: UIViewController {
    private enum Section { case main }

    private let store: CommentsStore
    private let openWeb: (UIViewController) -> Void
    private let filters = CommentFilter.allCases

    private var collectionView: UICollectionView!
    private var dataSource: UICollectionViewDiffableDataSource<Section, String>!
    private let refreshControl = UIRefreshControl()
    private let filterControl = UISegmentedControl(items: CommentFilter.allCases.map(\.rawValue.capitalized))

    init(service: CommentService, openWeb: @escaping (UIViewController) -> Void) {
        self.store = CommentsStore(service: service)
        self.openWeb = openWeb
        super.init(nibName: nil, bundle: nil)
        title = "Comments"
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        navigationItem.largeTitleDisplayMode = .always
        navigationItem.rightBarButtonItem = UIBarButtonItem(
            image: UIImage(systemName: "safari"),
            primaryAction: UIAction { [weak self] _ in
                guard let self else { return }
                self.openWeb(self)
            }
        )
        navigationItem.rightBarButtonItem?.accessibilityLabel = "Open comments on Web"

        configureFilter()
        configureCollectionView()
        Task { await reload() }
    }

    private func configureFilter() {
        filterControl.selectedSegmentIndex = 0
        filterControl.addAction(
            UIAction { [weak self] _ in
                guard let self else { return }
                self.store.filter = self.filters[self.filterControl.selectedSegmentIndex]
                Task { await self.reload() }
            },
            for: .valueChanged
        )
        filterControl.accessibilityIdentifier = "comments.filter"
        navigationItem.titleView = filterControl
    }

    private func configureCollectionView() {
        var configuration = UICollectionLayoutListConfiguration(appearance: .plain)
        configuration.leadingSwipeActionsConfigurationProvider = { [weak self] indexPath in
            guard let self, let id = dataSource.itemIdentifier(for: indexPath) else { return nil }
            let read = UIContextualAction(style: .normal, title: "Read") { _, _, done in
                Task { @MainActor in
                    await self.store.setState(id: id, state: 1)
                    self.applySnapshot()
                    self.updateFilterTitles()
                    done(true)
                }
            }
            read.backgroundColor = .systemBlue
            read.image = UIImage(systemName: "envelope.open")
            return UISwipeActionsConfiguration(actions: [read])
        }
        configuration.trailingSwipeActionsConfigurationProvider = { [weak self] indexPath in
            guard let self, let id = dataSource.itemIdentifier(for: indexPath) else { return nil }
            let junk = UIContextualAction(style: .destructive, title: "Junk") { _, _, done in
                Task { @MainActor in
                    await self.store.setState(id: id, state: 2)
                    self.applySnapshot()
                    self.updateFilterTitles()
                    done(true)
                }
            }
            junk.image = UIImage(systemName: "exclamationmark.bin")
            return UISwipeActionsConfiguration(actions: [junk])
        }

        collectionView = UICollectionView(
            frame: view.bounds,
            collectionViewLayout: UICollectionViewCompositionalLayout.list(using: configuration)
        )
        collectionView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        collectionView.delegate = self
        collectionView.accessibilityIdentifier = "comments.list"
        collectionView.refreshControl = refreshControl
        refreshControl.addAction(
            UIAction { [weak self] _ in Task { await self?.reload() } },
            for: .valueChanged
        )
        view.addSubview(collectionView)

        let registration = UICollectionView.CellRegistration<UICollectionViewListCell, Components.Schemas.CommentRow> {
            cell, _, comment in
            cell.contentConfiguration = UIHostingConfiguration {
                CommentRowView(comment: comment)
            }
            cell.accessories = [.disclosureIndicator()]
        }

        dataSource = UICollectionViewDiffableDataSource(collectionView: collectionView) {
            [weak self] collectionView, indexPath, id in
            guard let comment = self?.store.comments.first(where: { $0.id == id }) else { return nil }
            return collectionView.dequeueConfiguredReusableCell(
                using: registration,
                for: indexPath,
                item: comment
            )
        }
    }

    @MainActor
    private func reload() async {
        await store.reload()
        refreshControl.endRefreshing()
        applySnapshot()
        updateFilterTitles()
        showErrorIfNeeded()
    }

    private func applySnapshot() {
        var snapshot = NSDiffableDataSourceSnapshot<Section, String>()
        snapshot.appendSections([.main])
        snapshot.appendItems(store.comments.map(\.id))
        dataSource.apply(snapshot, animatingDifferences: true)
    }

    private func updateFilterTitles() {
        guard let counts = store.counts else { return }
        let values = [counts.unread, counts.awaiting, counts.junk, counts.all]
        for (index, filter) in filters.enumerated() {
            filterControl.setTitle("\(filter.rawValue.capitalized) \(values[index])", forSegmentAt: index)
        }
    }

    private func showErrorIfNeeded() {
        guard let message = store.errorMessage, presentedViewController == nil else { return }
        let alert = UIAlertController(title: "Comments", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }
}

extension CommentsViewController: UICollectionViewDelegate {
    func collectionView(_ collectionView: UICollectionView, didSelectItemAt indexPath: IndexPath) {
        collectionView.deselectItem(at: indexPath, animated: true)
        guard
            let id = dataSource.itemIdentifier(for: indexPath),
            let comment = store.comments.first(where: { $0.id == id })
        else { return }

        let detailStore = CommentDetailStore(service: store.service, seed: comment)
        let detail = CommentDetailView(
            store: detailStore,
            openWeb: { [weak self] in
                guard let self else { return }
                self.openWeb(self)
            },
            onDelete: { [weak self] in
                self?.navigationController?.popViewController(animated: true)
                Task { await self?.reload() }
            }
        )
        navigationController?.pushViewController(UIHostingController(rootView: detail), animated: true)
    }
}
