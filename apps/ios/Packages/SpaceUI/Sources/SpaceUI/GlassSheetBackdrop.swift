import SwiftUI

/// Sheet backdrop for the SwiftUI leaf screens. Content sits on plain
/// background; only the backdrop itself is glass.
public struct GlassSheetBackdrop<Content: View>: View {
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    private let content: Content

    public init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    public var body: some View {
        content
            .padding(Spacing.loose)
            .background {
                if reduceTransparency {
                    RoundedRectangle(cornerRadius: Radius.sheet, style: .continuous)
                        .fill(Color(GlassPalette.opaqueSurface))
                } else {
                    RoundedRectangle(cornerRadius: Radius.sheet, style: .continuous)
                        .fill(.clear)
                        .glassEffect(
                            .regular,
                            in: .rect(cornerRadius: Radius.sheet, style: .continuous)
                        )
                }
            }
    }
}
