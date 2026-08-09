import UIKit

public enum Spacing {
    public static let xSmall: CGFloat = 4
    public static let small: CGFloat = 8
    public static let medium: CGFloat = 12
    public static let regular: CGFloat = 16
    public static let large: CGFloat = 24
    public static let section: CGFloat = 32

    // Compatibility names used by the feature modules. They intentionally map
    // to the shared 4 / 8 / 12 / 16 / 24 / 32 spacing scale.
    public static let hairline = xSmall
    public static let tight = small
    public static let loose = large
}

public enum Radius {
    public static let control: CGFloat = 12
    /// One-line composer fields read as capsules and retain a stable radius
    /// as an auto-sizing field grows to multiple lines.
    public static let composer: CGFloat = 22
    public static let card: CGFloat = 16
    public static let sheet: CGFloat = 24
}

public enum SpacePalette {
    public static let page = dynamic(light: 0xFAF9F7, dark: 0x0A0A0C)
    public static let surface = dynamic(light: 0xFFFFFF, dark: 0x1C1C20)
    public static let inset = dynamic(light: 0xF5F4F1, dark: 0x101013)
    public static let primary = dynamic(light: 0x1C1917, dark: 0xFAFAF9)
    public static let muted = dynamic(light: 0x57534E, dark: 0xA8A29E)
    public static let subtle = dynamic(light: 0x78716C, dark: 0x78716C)
    public static let accent = dynamic(light: 0x2563EB, dark: 0x3B82F6)

    public static let success = UIColor(rgb: 0x059669)
    public static let warning = UIColor(rgb: 0xD97706)
    public static let danger = UIColor(rgb: 0xDC2626)
    public static let info = UIColor(rgb: 0x0284C7)

    private static func dynamic(light: UInt32, dark: UInt32) -> UIColor {
        UIColor { traits in
            UIColor(rgb: traits.userInterfaceStyle == .dark ? dark : light)
        }
    }
}

public enum GlassPalette {
    public static let tint = SpacePalette.accent
    public static let opaqueSurface = SpacePalette.surface
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

private extension UIColor {
    convenience init(rgb: UInt32, alpha: CGFloat = 1) {
        self.init(
            red: CGFloat((rgb >> 16) & 0xFF) / 255,
            green: CGFloat((rgb >> 8) & 0xFF) / 255,
            blue: CGFloat(rgb & 0xFF) / 255,
            alpha: alpha
        )
    }
}
