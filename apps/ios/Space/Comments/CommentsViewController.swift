import SpaceCore
import SwiftUI
import UIKit

final class CommentsViewController: UIViewController {
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

    private let store: CommentsStore
    private let openWeb: (UIViewController) -> Void

    private var collectionView: UICollectionView!
    private var dataSource: UICollectionViewDiffableDataSource<Section, String>!
    private let refreshControl = UIRefreshControl()
    private let filterBar = CommentFilterBar()

    init(service: CommentService, openWeb: @escaping (UIViewController) -> Void) {
        self.store = CommentsStore(service: service)
        self.openWeb = openWeb
        super.init(nibName: nil, bundle: nil)
        title = "Inbox"
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemGroupedBackground
        navigationItem.largeTitleDisplayMode = .always

        configureFilter()
        configureCollectionView()
        Task { await reload() }
    }

    private func configureFilter() {
        filterBar.onSelection = { [weak self] filter in
            self?.focus(on: filter)
        }
        view.addSubview(filterBar)
        filterBar.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            filterBar.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            filterBar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            filterBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            filterBar.heightAnchor.constraint(equalToConstant: 52),
        ])
    }

    private func configureCollectionView() {
        var configuration = UICollectionLayoutListConfiguration(appearance: .plain)
        configuration.backgroundColor = .systemGroupedBackground
        configuration.headerMode = .supplementary
        configuration.leadingSwipeActionsConfigurationProvider = { [weak self] indexPath in
            guard
                let self,
                let id = dataSource.itemIdentifier(for: indexPath),
                let comment = store.comments.first(where: { $0.id == id })
            else { return nil }
            let (title, icon, target): (String, String, CommentState) =
                switch CommentState(rawValue: comment.state) {
                case .unread: ("Read", "envelope.open", .read)
                case .junk: ("Not Junk", "tray.and.arrow.up", .read)
                default: ("Unread", "envelope.badge", .unread)
                }
            let action = UIContextualAction(style: .normal, title: title) { _, _, done in
                Task { @MainActor in
                    await self.store.setState(id: id, state: target)
                    self.applySnapshot()
                    self.updateFilterTitles()
                    done(true)
                }
            }
            action.backgroundColor = .systemBlue
            action.image = UIImage(systemName: icon)
            return UISwipeActionsConfiguration(actions: [action])
        }
        configuration.trailingSwipeActionsConfigurationProvider = { [weak self] indexPath in
            guard
                let self,
                let id = dataSource.itemIdentifier(for: indexPath),
                let comment = store.comments.first(where: { $0.id == id }),
                CommentState(rawValue: comment.state) != .junk
            else { return nil }
            let junk = UIContextualAction(style: .destructive, title: "Junk") { _, _, done in
                Task { @MainActor in
                    await self.store.setState(id: id, state: .junk)
                    self.applySnapshot()
                    self.updateFilterTitles()
                    done(true)
                }
            }
            junk.image = UIImage(systemName: "exclamationmark.bin")
            return UISwipeActionsConfiguration(actions: [junk])
        }

        collectionView = UICollectionView(
            frame: .zero,
            collectionViewLayout: UICollectionViewCompositionalLayout.list(using: configuration)
        )
        collectionView.delegate = self
        collectionView.accessibilityIdentifier = "comments.list"
        collectionView.refreshControl = refreshControl
        refreshControl.addAction(
            UIAction { [weak self] _ in Task { await self?.reload() } },
            for: .valueChanged
        )
        view.addSubview(collectionView)
        collectionView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            collectionView.topAnchor.constraint(equalTo: filterBar.bottomAnchor),
            collectionView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            collectionView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            collectionView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])

        let registration = UICollectionView.CellRegistration<UICollectionViewListCell, Components.Schemas.CommentRow> {
            cell, _, comment in
            cell.contentConfiguration = UIHostingConfiguration {
                CommentRowView(comment: comment)
            }
            cell.accessories = [.disclosureIndicator()]
            cell.accessibilityIdentifier = "comments.row"
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
        updateFilterTitles()
    }

    private func applySnapshot() {
        var snapshot = NSDiffableDataSourceSnapshot<Section, String>()
        for section in Section.allCases {
            let ids = comments(in: section).map(\.id)
            guard !ids.isEmpty else { continue }
            snapshot.appendSections([section])
            snapshot.appendItems(ids, toSection: section)
        }
        snapshot.reconfigureItems(snapshot.itemIdentifiers)
        dataSource.apply(snapshot, animatingDifferences: true)
        updateEmptyState()
    }

    private func updateFilterTitles() {
        filterBar.update(selected: store.filter, counts: store.counts)
    }

    private func comments(in section: Section) -> [Components.Schemas.CommentRow] {
        store.comments.filter { comment in
            let isToday = Calendar.current.isDateInToday(comment.createdAt)
            return section == .today ? isToday : !isToday
        }
    }

    private func updateEmptyState() {
        guard store.comments.isEmpty, !store.isLoading else {
            collectionView.backgroundView = nil
            return
        }
        var configuration = UIContentUnavailableConfiguration.empty()
        if let message = store.errorMessage {
            configuration.image = UIImage(systemName: "exclamationmark.triangle")
            configuration.text = "Could not load comments"
            configuration.secondaryText = message
            var retry = UIButton.Configuration.plain()
            retry.title = "Retry"
            configuration.button = retry
            configuration.buttonProperties.primaryAction = UIAction { [weak self] _ in
                Task { await self?.reload() }
            }
        } else {
            configuration.image = UIImage(systemName: "tray")
            configuration.text = store.filter == .all
                ? "No comments"
                : "No \(store.filter.rawValue) comments"
            configuration.secondaryText = store.filter == .unread
                ? "New comments that need attention will appear here."
                : "Choose another filter to review more comments."
        }
        collectionView.backgroundView = UIContentUnavailableView(configuration: configuration)
    }

    func focus(on filter: CommentFilter) {
        store.filter = filter
        filterBar.update(selected: filter, counts: store.counts)
        guard isViewLoaded else { return }
        Task { await reload() }
    }

    func open(id: String) {
        let seed = store.comments.first(where: { $0.id == id })
        showDetail(id: id, seed: seed)
    }

    private func showDetail(id: String, seed: Components.Schemas.CommentRow?) {
        let detailStore = seed.map { CommentDetailStore(service: store.service, seed: $0) }
            ?? CommentDetailStore(service: store.service, id: id)
        let detail = CommentDetailView(
            store: detailStore,
            openWeb: { [weak self] in
                guard let self else { return }
                self.openWeb(self)
            },
            onDelete: { [weak self] in
                self?.navigationController?.popViewController(animated: true)
                Task { await self?.reload() }
            },
            onMutation: { [weak self] in
                Task { await self?.reload() }
            }
        )
        navigationController?.pushViewController(UIHostingController(rootView: detail), animated: true)
    }
}

extension CommentsViewController: UICollectionViewDelegate {
    func collectionView(_ collectionView: UICollectionView, didSelectItemAt indexPath: IndexPath) {
        collectionView.deselectItem(at: indexPath, animated: true)
        guard
            let id = dataSource.itemIdentifier(for: indexPath),
            let comment = store.comments.first(where: { $0.id == id })
        else { return }

        showDetail(id: id, seed: comment)
    }
}
