import SwiftUI

/// The input itself is the only content-layer surface in an inline composer.
/// Its parent remains transparent so it does not compete with a navigation or
/// tab-bar material as a second full-width bar.
public struct ComposerFieldSurface: ViewModifier {
    public init() {}

    public func body(content: Content) -> some View {
        content
            .padding(.horizontal, Spacing.regular)
            .padding(.vertical, 10)
            .frame(minHeight: 44, alignment: .leading)
            .background(
                Color(SpacePalette.inset),
                in: .rect(cornerRadius: Radius.composer, style: .continuous)
            )
            .overlay {
                RoundedRectangle(cornerRadius: Radius.composer, style: .continuous)
                    .stroke(Color(.separator).opacity(0.16), lineWidth: 0.5)
            }
    }
}

public extension View {
    func composerFieldSurface() -> some View {
        modifier(ComposerFieldSurface())
    }
}
