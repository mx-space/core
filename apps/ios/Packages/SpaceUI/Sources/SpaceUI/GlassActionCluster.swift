import UIKit

/// A row of floating actions whose glass merges as the buttons approach one
/// another, driven by `UIGlassContainerEffect`.
public final class GlassActionCluster: UIView {
    private let container = UIVisualEffectView()
    private let stack = UIStackView()

    public var spacing: CGFloat {
        get { stack.spacing }
        set { stack.spacing = newValue }
    }

    public override init(frame: CGRect) {
        super.init(frame: frame)

        stack.axis = .horizontal
        stack.spacing = Spacing.tight
        stack.alignment = .center

        addSubview(container)
        container.translatesAutoresizingMaskIntoConstraints = false
        container.contentView.addSubview(stack)
        stack.translatesAutoresizingMaskIntoConstraints = false

        NSLayoutConstraint.activate([
            container.topAnchor.constraint(equalTo: topAnchor),
            container.bottomAnchor.constraint(equalTo: bottomAnchor),
            container.leadingAnchor.constraint(equalTo: leadingAnchor),
            container.trailingAnchor.constraint(equalTo: trailingAnchor),
            stack.topAnchor.constraint(equalTo: container.contentView.topAnchor),
            stack.bottomAnchor.constraint(equalTo: container.contentView.bottomAnchor),
            stack.leadingAnchor.constraint(equalTo: container.contentView.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: container.contentView.trailingAnchor),
        ])

        applyEffect()
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(applyEffect),
            name: UIAccessibility.reduceTransparencyStatusDidChangeNotification,
            object: nil
        )
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    public func setActions(_ views: [UIView]) {
        for existing in stack.arrangedSubviews {
            stack.removeArrangedSubview(existing)
            existing.removeFromSuperview()
        }
        for view in views {
            stack.addArrangedSubview(wrapped(view))
        }
    }

    private func wrapped(_ view: UIView) -> UIView {
        guard GlassAvailability.isGlassAllowed else {
            view.backgroundColor = GlassPalette.opaqueSurface
            view.layer.cornerRadius = Radius.control
            view.layer.cornerCurve = .continuous
            return view
        }

        let effectView = UIVisualEffectView()
        let glass = UIGlassEffect()
        glass.isInteractive = true
        effectView.effect = glass
        effectView.cornerConfiguration = .capsule()
        effectView.contentView.addSubview(view)
        view.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            view.topAnchor.constraint(equalTo: effectView.contentView.topAnchor),
            view.bottomAnchor.constraint(equalTo: effectView.contentView.bottomAnchor),
            view.leadingAnchor.constraint(equalTo: effectView.contentView.leadingAnchor),
            view.trailingAnchor.constraint(equalTo: effectView.contentView.trailingAnchor),
        ])
        return effectView
    }

    @objc private func applyEffect() {
        guard GlassAvailability.isGlassAllowed else {
            container.effect = nil
            container.backgroundColor = .clear
            return
        }
        container.backgroundColor = .clear
        container.effect = UIGlassContainerEffect()
    }
}
