import SpaceCore
import UIKit

final class CommentFilterBar: UIView {
    private let filters = CommentFilter.allCases
    private let scrollView = UIScrollView()
    private let stack = UIStackView()
    private let separator = UIView()
    private var buttons: [UIButton] = []

    var onSelection: ((CommentFilter) -> Void)?

    override init(frame: CGRect) {
        super.init(frame: frame)

        backgroundColor = .systemGroupedBackground
        scrollView.showsHorizontalScrollIndicator = false
        scrollView.alwaysBounceHorizontal = true

        stack.axis = .horizontal
        stack.alignment = .center
        stack.spacing = 8

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
            stack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor, constant: 8),
            stack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor, constant: -8),
            stack.leadingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.trailingAnchor, constant: -16),
            stack.heightAnchor.constraint(equalTo: scrollView.frameLayoutGuide.heightAnchor, constant: -16),
        ])

        for (index, filter) in filters.enumerated() {
            let button = UIButton(type: .system)
            button.tag = index
            button.addTarget(self, action: #selector(selectFilter(_:)), for: .touchUpInside)
            button.accessibilityIdentifier = "comments.filter.\(filter.rawValue)"
            buttons.append(button)
            stack.addArrangedSubview(button)
        }

        update(selected: .unread, counts: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    func update(selected: CommentFilter, counts: Components.Schemas.CommentTabCounts?) {
        for (index, filter) in filters.enumerated() {
            var configuration = filter == selected
                ? UIButton.Configuration.tinted()
                : UIButton.Configuration.plain()
            configuration.cornerStyle = .capsule
            configuration.title = title(for: filter, counts: counts)
            configuration.contentInsets = NSDirectionalEdgeInsets(
                top: 7,
                leading: 12,
                bottom: 7,
                trailing: 12
            )
            buttons[index].configuration = configuration
            buttons[index].accessibilityValue = filter == selected ? "Selected" : nil
        }
    }

    @objc private func selectFilter(_ sender: UIButton) {
        guard filters.indices.contains(sender.tag) else { return }
        onSelection?(filters[sender.tag])
    }

    private func title(
        for filter: CommentFilter,
        counts: Components.Schemas.CommentTabCounts?
    ) -> String {
        let label = filter.rawValue.capitalized
        guard let counts else { return label }
        let count = switch filter {
        case .unread: counts.unread
        case .awaiting: counts.awaiting
        case .junk: counts.junk
        case .all: counts.all
        }
        return "\(label) \(count)"
    }
}
