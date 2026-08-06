import UIKit

/// Backdrop for a floating top or bottom bar.
public final class GlassBar: UIView {
    private let effectView = UIVisualEffectView()

    public var cornerRadius: CGFloat = Radius.card {
        didSet { applyEffect() }
    }

    public var contentView: UIView { effectView.contentView }

    public override init(frame: CGRect) {
        super.init(frame: frame)
        addSubview(effectView)
        effectView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            effectView.topAnchor.constraint(equalTo: topAnchor),
            effectView.bottomAnchor.constraint(equalTo: bottomAnchor),
            effectView.leadingAnchor.constraint(equalTo: leadingAnchor),
            effectView.trailingAnchor.constraint(equalTo: trailingAnchor),
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

    @objc private func applyEffect() {
        effectView.layer.cornerRadius = cornerRadius
        effectView.layer.cornerCurve = .continuous
        effectView.clipsToBounds = true

        guard GlassAvailability.isGlassAllowed else {
            effectView.effect = nil
            effectView.backgroundColor = GlassPalette.opaqueSurface
            return
        }
        effectView.backgroundColor = .clear
        let glass = UIGlassEffect()
        glass.isInteractive = false
        effectView.effect = glass
    }
}
