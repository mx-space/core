import SpaceCore
import SpaceUI
import SwiftUI
import UIKit

final class CommentsViewController: UIViewController {
    private struct DaySection: Hashable {
        let day: Date

        var title: String {
            let calendar = Calendar.current
            if calendar.isDateInToday(day) { return "Today" }
            if calendar.isDateInYesterday(day) { return "Yesterday" }
            return day.formatted(.dateTime.month(.wide).day().year())
        }
    }

    private let store: CommentsStore
    private let openWeb: (UIViewController) -> Void
    private let onUnreadCountChange: (Int) -> Void

    private var collectionView: UICollectionView!
    private var dataSource: UICollectionViewDiffableDataSource<DaySection, String>!
    private let refreshControl = UIRefreshControl()
    private let filterBar = CommentFilterBar()
    private let errorButton = UIButton(type: .system)
    private var errorHeightConstraint: NSLayoutConstraint!

    init(
        service: CommentService,
        openWeb: @escaping (UIViewController) -> Void,
        onUnreadCountChange: @escaping (Int) -> Void = { _ in }
    ) {
        store = CommentsStore(service: service)
        self.openWeb = openWeb
        self.onUnreadCountChange = onUnreadCountChange
        super.init(nibName: nil, bundle: nil)
        title = "Inbox"
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = SpacePalette.page
        navigationItem.largeTitleDisplayMode = .always

        configureFilter()
        configureErrorBanner()
        configureCollectionView()
        filterBar.update(selected: store.filter, counts: store.counts)
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

    private func configureErrorBanner() {
        var configuration = UIButton.Configuration.glass()
        configuration.image = UIImage(systemName: "exclamationmark.triangle")
        configuration.imagePadding = Spacing.small
        configuration.title = "Refresh failed — Retry"
        configuration.cornerStyle = .capsule
        configuration.baseForegroundColor = SpacePalette.warning
        errorButton.configuration = configuration
        errorButton.accessibilityIdentifier = "comments.refreshError"
        errorButton.addAction(
            UIAction { [weak self] _ in Task { await self?.reload() } },
            for: .touchUpInside
        )
        view.addSubview(errorButton)
        errorButton.translatesAutoresizingMaskIntoConstraints = false
        errorHeightConstraint = errorButton.heightAnchor.constraint(equalToConstant: 0)
        NSLayoutConstraint.activate([
            errorButton.topAnchor.constraint(equalTo: filterBar.bottomAnchor),
            errorButton.leadingAnchor.constraint(
                equalTo: view.leadingAnchor,
                constant: Spacing.regular
            ),
            errorButton.trailingAnchor.constraint(
                equalTo: view.trailingAnchor,
                constant: -Spacing.regular
            ),
            errorHeightConstraint,
        ])
    }

    private func configureCollectionView() {
        var configuration = UICollectionLayoutListConfiguration(appearance: .plain)
        configuration.backgroundColor = SpacePalette.page
        configuration.headerMode = .supplementary
        configuration.leadingSwipeActionsConfigurationProvider = { [weak self] indexPath in
            self?.leadingActions(at: indexPath)
        }
        configuration.trailingSwipeActionsConfigurationProvider = { [weak self] indexPath in
            self?.trailingActions(at: indexPath)
        }

        collectionView = UICollectionView(
            frame: .zero,
            collectionViewLayout: UICollectionViewCompositionalLayout.list(using: configuration)
        )
        collectionView.backgroundColor = SpacePalette.page
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
            collectionView.topAnchor.constraint(equalTo: errorButton.bottomAnchor),
            collectionView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            collectionView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            collectionView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])

        let registration = UICollectionView.CellRegistration<
            UICollectionViewListCell,
            Components.Schemas.CommentRow
        > { cell, _, comment in
            cell.contentConfiguration = UIHostingConfiguration {
                CommentRowView(comment: comment)
            }
            .margins(.horizontal, Spacing.regular)
            .margins(.vertical, 0)
            cell.backgroundConfiguration = UIBackgroundConfiguration.clear()
            cell.accessories = [.disclosureIndicator()]
            cell.accessibilityIdentifier = "comments.row"
        }

        dataSource = UICollectionViewDiffableDataSource(collectionView: collectionView) {
            [weak self] collectionView, indexPath, id in
            guard let comment = self?.store.comments.first(where: { $0.id == id }) else {
                return nil
            }
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
                indexPath.section < dataSource.snapshot().sectionIdentifiers.count
            else { return }
            let section = dataSource.snapshot().sectionIdentifiers[indexPath.section]
            var content = UIListContentConfiguration.header()
            content.text = section.title
            content.textProperties.color = SpacePalette.muted
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

    private func leadingActions(at indexPath: IndexPath) -> UISwipeActionsConfiguration? {
        guard
            let id = dataSource.itemIdentifier(for: indexPath),
            let comment = store.comments.first(where: { $0.id == id })
        else { return nil }

        if store.filter == .awaiting {
            let reply = UIContextualAction(style: .normal, title: "Reply") {
                [weak self] _, _, completion in
                self?.showDetail(id: id, seed: comment)
                completion(true)
            }
            reply.image = UIImage(systemName: "arrowshape.turn.up.left")
            reply.backgroundColor = SpacePalette.accent
            return swipeConfiguration([reply])
        }

        let state = CommentState(rawValue: comment.state)
        let title: String
        let image: String
        let target: CommentState
        switch state {
        case .unread:
            title = "Read"
            image = "envelope.open"
            target = .read
        case .junk:
            title = "Restore"
            image = "tray.and.arrow.up"
            target = .read
        default:
            title = "Unread"
            image = "envelope.badge"
            target = .unread
        }

        let action = stateAction(id: id, title: title, image: image, target: target)
        return swipeConfiguration([action])
    }

    private func trailingActions(at indexPath: IndexPath) -> UISwipeActionsConfiguration? {
        guard
            let id = dataSource.itemIdentifier(for: indexPath),
            let comment = store.comments.first(where: { $0.id == id }),
            CommentState(rawValue: comment.state) != .junk
        else { return nil }

        let junk = UIContextualAction(style: .destructive, title: "Junk") {
            [weak self] _, _, completion in
            guard let self else {
                completion(false)
                return
            }
            Task { @MainActor in
                await store.setState(id: id, state: .junk)
                applySnapshot()
                updateChrome()
                completion(true)
            }
        }
        junk.image = UIImage(systemName: "exclamationmark.bin")
        return swipeConfiguration([junk])
    }

    private func stateAction(
        id: String,
        title: String,
        image: String,
        target: CommentState
    ) -> UIContextualAction {
        let action = UIContextualAction(style: .normal, title: title) {
            [weak self] _, _, completion in
            guard let self else {
                completion(false)
                return
            }
            Task { @MainActor in
                await store.setState(id: id, state: target)
                applySnapshot()
                updateChrome()
                completion(true)
            }
        }
        action.backgroundColor = SpacePalette.accent
        action.image = UIImage(systemName: image)
        return action
    }

    private func swipeConfiguration(
        _ actions: [UIContextualAction]
    ) -> UISwipeActionsConfiguration {
        let configuration = UISwipeActionsConfiguration(actions: actions)
        configuration.performsFirstActionWithFullSwipe = false
        return configuration
    }

    @MainActor
    private func reload() async {
        await store.reload()
        refreshControl.endRefreshing()
        applySnapshot()
        updateChrome()
    }

    private func applySnapshot() {
        var snapshot = NSDiffableDataSourceSnapshot<DaySection, String>()
        for section in sections {
            let ids = comments(in: section).map(\.id)
            snapshot.appendSections([section])
            snapshot.appendItems(ids, toSection: section)
        }
        snapshot.reconfigureItems(snapshot.itemIdentifiers)
        dataSource.apply(snapshot, animatingDifferences: true)
        updateEmptyState()
    }

    private var sections: [DaySection] {
        let calendar = Calendar.current
        let days = Set(store.comments.map { calendar.startOfDay(for: $0.createdAt) })
        return days.sorted(by: >).map(DaySection.init(day:))
    }

    private func comments(in section: DaySection) -> [Components.Schemas.CommentRow] {
        let calendar = Calendar.current
        return store.comments.filter {
            calendar.isDate($0.createdAt, inSameDayAs: section.day)
        }
    }

    private func updateChrome() {
        filterBar.update(selected: store.filter, counts: store.counts)
        if let unread = store.counts?.unread {
            onUnreadCountChange(unread)
        }

        let showBanner = store.errorMessage != nil && !store.comments.isEmpty
        errorHeightConstraint.constant = showBanner ? 40 : 0
        errorButton.isHidden = !showBanner
        errorButton.accessibilityHint = store.errorMessage
    }

    private func updateEmptyState() {
        guard store.comments.isEmpty else {
            collectionView.backgroundView = nil
            return
        }

        if store.isLoading {
            var configuration = UIContentUnavailableConfiguration.loading()
            configuration.text = "Loading comments"
            collectionView.backgroundView = UIContentUnavailableView(configuration: configuration)
            return
        }

        var configuration = UIContentUnavailableConfiguration.empty()
        if let message = store.errorMessage {
            configuration.image = UIImage(systemName: "exclamationmark.triangle")
            configuration.text = "Could not load comments"
            configuration.secondaryText = message
            var retry = UIButton.Configuration.glass()
            retry.title = "Retry"
            retry.cornerStyle = .capsule
            configuration.button = retry
            configuration.buttonProperties.primaryAction = UIAction { [weak self] _ in
                Task { await self?.reload() }
            }
        } else {
            let copy = emptyCopy(for: store.filter)
            configuration.image = UIImage(systemName: copy.image)
            configuration.text = copy.title
            configuration.secondaryText = copy.detail
        }
        collectionView.backgroundView = UIContentUnavailableView(configuration: configuration)
    }

    private func emptyCopy(for filter: CommentFilter) -> (
        title: String,
        detail: String,
        image: String
    ) {
        switch filter {
        case .all:
            ("No comments", "New comments will appear here.", "tray")
        case .unread:
            ("No unread comments", "Everything has been reviewed.", "checkmark.circle")
        case .awaiting:
            ("No comments awaiting a reply", "There is nothing waiting for an owner response.", "arrowshape.turn.up.left")
        case .whispers:
            ("No whispers", "Private comments will appear here.", "eye.slash")
        case .read:
            ("No read comments", "Reviewed comments will appear here.", "envelope.open")
        case .junk:
            ("No junk comments", "Comments moved to junk will appear here.", "exclamationmark.bin")
        }
    }

    func focus(on filter: CommentFilter) {
        store.filter = filter
        guard isViewLoaded else { return }
        filterBar.update(selected: filter, counts: store.counts)
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
                openWeb(self)
            },
            onDelete: { [weak self] in
                self?.navigationController?.popViewController(animated: true)
                Task { await self?.reload() }
            },
            onMutation: { [weak self] in
                Task { await self?.reload() }
            }
        )
        let controller = UIHostingController(rootView: detail)
        controller.hidesBottomBarWhenPushed = true
        navigationController?.pushViewController(controller, animated: true)
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

extension CommentsViewController: ScrollToTopHandling {
    func scrollToTop() {
        guard collectionView.numberOfSections > 0 else { return }
        collectionView.setContentOffset(
            CGPoint(x: 0, y: -collectionView.adjustedContentInset.top),
            animated: true
        )
    }
}
