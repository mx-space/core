import UIKit

/// The shared primary action used by full-page flows.
///
/// `prominentGlass` preserves the visual hierarchy of a primary action while
/// the explicit intrinsic height keeps the control comfortably tappable.
public final class PrimaryGlassButton: UIButton {
    public static let minimumHeight: CGFloat = 52

    public init(title: String) {
        super.init(frame: .zero)

        var configuration = UIButton.Configuration.prominentGlass()
        configuration.title = title
        configuration.cornerStyle = .capsule
        configuration.contentInsets = NSDirectionalEdgeInsets(
            top: Spacing.regular,
            leading: Spacing.loose,
            bottom: Spacing.regular,
            trailing: Spacing.loose
        )
        self.configuration = configuration
        tintColor = SpacePalette.accent
        titleLabel?.adjustsFontForContentSizeCategory = true
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    public override var intrinsicContentSize: CGSize {
        var size = super.intrinsicContentSize
        size.height = max(size.height, Self.minimumHeight)
        return size
    }
}
