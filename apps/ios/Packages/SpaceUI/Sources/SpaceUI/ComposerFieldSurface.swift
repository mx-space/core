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
            .composerContainerSurface()
    }
}

/// Shared shell for compound composers where text and the primary action live
/// in one continuous field, matching the visual hierarchy of system messaging
/// interfaces without forcing identical internal padding on every consumer.
public struct ComposerContainerSurface: ViewModifier {
    public init() {}

    public func body(content: Content) -> some View {
        content
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

    func composerContainerSurface() -> some View {
        modifier(ComposerContainerSurface())
    }
}
