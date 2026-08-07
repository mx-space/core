import SpaceCore
import SpaceUI
import SwiftUI
import UIKit

final class RecentlyViewController: UIViewController {
    private enum Section: CaseIterable {
        case today
        case earlier

        var title: String {
            switch self {
            case .today: "Today"
            case .earlier: "Earlier"
            }
        }
    }

    private let store: RecentlyStore
    private let service: RecentlyService

    private var collectionView: UICollectionView!
    private var dataSource: UICollectionViewDiffableDataSource<Section, String>!
    private let refreshControl = UIRefreshControl()

    init(service: RecentlyService) {
        self.service = service
        self.store = RecentlyStore(service: service)
        super.init(nibName: nil, bundle: nil)
        title = "Content"
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        navigationItem.largeTitleDisplayMode = .always

        configureCollectionView()
        Task { await reload() }
    }

    private func configureCollectionView() {
        var configuration = UICollectionLayoutListConfiguration(appearance: .plain)
        configuration.backgroundColor = .systemGroupedBackground
        configuration.headerMode = .supplementary
        configuration.showsSeparators = false
        configuration.trailingSwipeActionsConfigurationProvider = { [weak self] indexPath in
            guard let self, let id = dataSource.itemIdentifier(for: indexPath) else { return nil }
            let delete = UIContextualAction(style: .destructive, title: "Delete") { _, _, done in
                self.confirmDeletion(of: id, completion: done)
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
            cell.contentConfiguration = UIHostingConfiguration { RecentlyRowView(entry: entry) }
                .margins(.horizontal, Spacing.regular)
                .margins(.vertical, Spacing.tight)
            cell.backgroundConfiguration = UIBackgroundConfiguration.clear()
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

        let headerRegistration = UICollectionView.SupplementaryRegistration<UICollectionViewListCell>(
            elementKind: UICollectionView.elementKindSectionHeader
        ) { [weak self] header, _, indexPath in
            guard
                let self,
                indexPath.section < self.dataSource.snapshot().sectionIdentifiers.count
            else { return }
            let section = self.dataSource.snapshot().sectionIdentifiers[indexPath.section]
            var content = UIListContentConfiguration.header()
            content.text = section.title
            header.contentConfiguration = content
            header.backgroundConfiguration = UIBackgroundConfiguration.clear()
        }
        dataSource.supplementaryViewProvider = { collectionView, _, indexPath in
            collectionView.dequeueConfiguredReusableSupplementary(
                using: headerRegistration,
                for: indexPath
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
        for section in Section.allCases {
            let ids = entries(in: section).map(\.id)
            guard !ids.isEmpty else { continue }
            snapshot.appendSections([section])
            snapshot.appendItems(ids, toSection: section)
        }
        dataSource.apply(snapshot, animatingDifferences: true)
        updateEmptyState()
    }

    private func entries(in section: Section) -> [RecentlyCard] {
        store.entries.filter { entry in
            let isToday = Calendar.current.isDateInToday(entry.createdAt)
            return section == .today ? isToday : !isToday
        }
    }

    private func updateEmptyState() {
        guard store.entries.isEmpty, !store.isLoading else {
            collectionView.backgroundView = nil
            return
        }
        var configuration = UIContentUnavailableConfiguration.empty()
        configuration.image = UIImage(systemName: "text.bubble")
        configuration.text = "No recently entries"
        configuration.secondaryText = "Use the create button below to publish a short update."
        collectionView.backgroundView = UIContentUnavailableView(configuration: configuration)
    }

    @MainActor
    private func showErrorIfNeeded() {
        guard let message = store.errorMessage else { return }
        let alert = UIAlertController(title: "Recently", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        present(alert, animated: true)
    }

    func presentComposer(
        from presenter: UIViewController? = nil,
        entry: RecentlyCard? = nil,
        onSaved: (() -> Void)? = nil
    ) {
        let composer = RecentlyComposerView(
            service: service,
            initialText: entry?.content ?? "",
            navigationTitle: entry == nil ? "New Recently" : "Edit Recently"
        ) { [weak self] content in
            guard let self else { return "Composer lost its list" }
            let failure = await store.save(id: entry?.id, content: content)
            if failure == nil {
                if isViewLoaded { applySnapshot() }
                onSaved?()
            }
            return failure
        }
        let controller = UIHostingController(rootView: composer)
        controller.modalPresentationStyle = .fullScreen
        (presenter ?? self).present(controller, animated: true)
    }

    private func confirmDeletion(of id: String, completion: @escaping (Bool) -> Void) {
        let alert = UIAlertController(
            title: "Delete this Recently entry?",
            message: "This action cannot be undone.",
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completion(false) })
        alert.addAction(UIAlertAction(title: "Delete", style: .destructive) { [weak self] _ in
            guard let self else {
                completion(false)
                return
            }
            Task { @MainActor in
                await self.store.delete(id: id)
                self.applySnapshot()
                completion(true)
            }
        })
        present(alert, animated: true)
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
