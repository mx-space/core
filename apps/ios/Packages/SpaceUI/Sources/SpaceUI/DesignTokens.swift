import UIKit

public enum Spacing {
    public static let hairline: CGFloat = 2
    public static let tight: CGFloat = 6
    public static let regular: CGFloat = 12
    public static let loose: CGFloat = 20
    public static let section: CGFloat = 32
}

public enum Radius {
    public static let control: CGFloat = 14
    public static let card: CGFloat = 20
    public static let sheet: CGFloat = 28
}

public enum GlassPalette {
    public static let tint = UIColor.tintColor
    public static let opaqueSurface = UIColor.secondarySystemBackground
    public static let separator = UIColor.separator
}

@MainActor
public enum GlassAvailability {
    /// Every glass surface collapses to an opaque fill when the user has asked
    /// the system to reduce transparency.
    public static var isGlassAllowed: Bool {
        !UIAccessibility.isReduceTransparencyEnabled
    }
}
