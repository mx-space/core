import Testing
import UIKit

@testable import SpaceUI

@MainActor
@Suite struct GlassComponentTests {
    @Test func barExposesContentViewForHosting() {
        let bar = GlassBar(frame: .zero)
        let label = UILabel()
        bar.contentView.addSubview(label)
        #expect(label.superview === bar.contentView)
    }

    @Test func clusterReplacesPreviousActions() {
        let cluster = GlassActionCluster(frame: .zero)
        cluster.setActions([UIButton(), UIButton()])
        cluster.setActions([UIButton()])

        let stack = cluster.subviews
            .compactMap { $0 as? UIVisualEffectView }
            .flatMap(\.contentView.subviews)
            .compactMap { $0 as? UIStackView }
            .first

        #expect(stack?.arrangedSubviews.count == 1)
    }

    @Test func glassIsDisallowedWhenTransparencyIsReduced() {
        #expect(GlassAvailability.isGlassAllowed == !UIAccessibility.isReduceTransparencyEnabled)
    }

    @Test func primaryButtonKeepsALargeTapTarget() {
        let button = PrimaryGlassButton(title: "Continue")

        #expect(button.intrinsicContentSize.height >= PrimaryGlassButton.minimumHeight)
    }
}
