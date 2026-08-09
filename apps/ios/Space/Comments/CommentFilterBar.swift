import SpaceCore
import SpaceUI
import UIKit

final class CommentFilterBar: UIView {
    private let filters = CommentFilter.allCases
    private let scrollView = UIScrollView()
    private let stack = UIStackView()
    private let separator = UIView()
    private var chips: [CommentFilterChip] = []

    var onSelection: ((CommentFilter) -> Void)?

    override init(frame: CGRect) {
        super.init(frame: frame)

        backgroundColor = SpacePalette.page
        scrollView.showsHorizontalScrollIndicator = false
        scrollView.alwaysBounceHorizontal = true

        stack.axis = .horizontal
        stack.alignment = .center
        stack.spacing = Spacing.small

        separator.backgroundColor = .separator

        addSubview(scrollView)
        addSubview(separator)
        scrollView.addSubview(stack)
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        separator.translatesAutoresizingMaskIntoConstraints = false
        stack.translatesAutoresizingMaskIntoConstraints = false

        NSLayoutConstraint.activate([
            separator.leadingAnchor.constraint(equalTo: leadingAnchor),
            separator.trailingAnchor.constraint(equalTo: trailingAnchor),
            separator.bottomAnchor.constraint(equalTo: bottomAnchor),
            separator.heightAnchor.constraint(equalToConstant: 1 / UIScreen.main.scale),
            scrollView.topAnchor.constraint(equalTo: topAnchor),
            scrollView.bottomAnchor.constraint(equalTo: bottomAnchor),
            scrollView.leadingAnchor.constraint(equalTo: leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: trailingAnchor),
            stack.topAnchor.constraint(
                equalTo: scrollView.contentLayoutGuide.topAnchor,
                constant: Spacing.small
            ),
            stack.bottomAnchor.constraint(
                equalTo: scrollView.contentLayoutGuide.bottomAnchor,
                constant: -Spacing.small
            ),
            stack.leadingAnchor.constraint(
                equalTo: scrollView.contentLayoutGuide.leadingAnchor,
                constant: Spacing.regular
            ),
            stack.trailingAnchor.constraint(
                equalTo: scrollView.contentLayoutGuide.trailingAnchor,
                constant: -Spacing.regular
            ),
            stack.heightAnchor.constraint(
                equalTo: scrollView.frameLayoutGuide.heightAnchor,
                constant: -Spacing.regular
            ),
        ])

        for (index, filter) in filters.enumerated() {
            let chip = CommentFilterChip(title: filter.title)
            chip.tag = index
            chip.addTarget(self, action: #selector(selectFilter(_:)), for: .touchUpInside)
            chip.accessibilityIdentifier = "comments.filter.\(filter.rawValue)"
            chips.append(chip)
            stack.addArrangedSubview(chip)
        }

        update(selected: .unread, counts: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func update(selected: CommentFilter, counts: Components.Schemas.CommentTabCounts?) {
        for (index, filter) in filters.enumerated() {
            chips[index].isSelected = filter == selected
            chips[index].count = count(for: filter, counts: counts)
        }

        guard let index = filters.firstIndex(of: selected) else { return }
        layoutIfNeeded()
        let frame = stack.convert(chips[index].frame, to: scrollView)
        scrollView.scrollRectToVisible(
            frame.insetBy(dx: -Spacing.regular, dy: 0),
            animated: true
        )
    }

    @objc private func selectFilter(_ sender: UIControl) {
        guard filters.indices.contains(sender.tag) else { return }
        onSelection?(filters[sender.tag])
    }

    private func count(
        for filter: CommentFilter,
        counts: Components.Schemas.CommentTabCounts?
    ) -> Int? {
        guard let counts else { return nil }
        return switch filter {
        case .all: counts.all
        case .unread: counts.unread
        case .awaiting: counts.awaiting
        case .whispers: counts.whispers
        case .read: counts.read
        case .junk: counts.junk
        }
    }
}

private final class CommentFilterChip: UIButton {
    private let nameLabel = UILabel()
    private let countLabel = UILabel()
    private let stack = UIStackView()

    var count: Int? {
        didSet {
            countLabel.text = count.map(String.init)
            countLabel.isHidden = count == nil
            updateAccessibility()
        }
    }

    override var isSelected: Bool {
        didSet { updateAppearance() }
    }

    init(title: String) {
        super.init(frame: .zero)

        nameLabel.text = title
        nameLabel.font = .preferredFont(forTextStyle: .subheadline)
        nameLabel.adjustsFontForContentSizeCategory = true

        countLabel.font = UIFontMetrics(forTextStyle: .caption1).scaledFont(
            for: .monospacedSystemFont(ofSize: 12, weight: .semibold)
        )
        countLabel.adjustsFontForContentSizeCategory = true

        stack.axis = .horizontal
        stack.alignment = .center
        stack.spacing = Spacing.small
        stack.isUserInteractionEnabled = false
        stack.addArrangedSubview(nameLabel)
        stack.addArrangedSubview(countLabel)
        addSubview(stack)
        stack.translatesAutoresizingMaskIntoConstraints = false

        NSLayoutConstraint.activate([
            heightAnchor.constraint(greaterThanOrEqualToConstant: 34),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),
            stack.topAnchor.constraint(equalTo: topAnchor, constant: 6),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -6),
        ])

        updateAppearance()
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    private func updateAppearance() {
        var configuration = isSelected
            ? UIButton.Configuration.prominentGlass()
            : UIButton.Configuration.glass()
        configuration.cornerStyle = .capsule
        configuration.contentInsets = .zero
        configuration.baseBackgroundColor = isSelected ? SpacePalette.accent : nil
        self.configuration = configuration
        tintColor = SpacePalette.accent

        nameLabel.textColor = isSelected ? .white : SpacePalette.primary
        countLabel.textColor = isSelected ? UIColor.white.withAlphaComponent(0.76) : SpacePalette.subtle
        updateAccessibility()
    }

    private func updateAccessibility() {
        let countValue = count.map { ", \($0)" } ?? ""
        accessibilityLabel = "\(nameLabel.text ?? "")\(countValue)"
        if isSelected {
            accessibilityTraits.insert(.selected)
        } else {
            accessibilityTraits.remove(.selected)
        }
    }
}

private extension CommentFilter {
    var title: String {
        switch self {
        case .all: "All"
        case .unread: "Unread"
        case .awaiting: "Awaiting"
        case .whispers: "Whispers"
        case .read: "Read"
        case .junk: "Junk"
        }
    }
}
