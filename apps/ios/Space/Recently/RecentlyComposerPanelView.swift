import SpaceUI
import SwiftUI

struct RecentlyComposerPanelView: View {
    @Bindable var store: RecentlyComposerStore

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(spacing: 0) {
            if store.isChoosingContext {
                RecentlyCommandSearchView(store: store)
                    .transition(panelTransition)
            } else if store.isShowingSlashMenu {
                RecentlySlashMenuView(commands: store.slashCommands) { command in
                    store.executeSlashCommand(command)
                }
                .transition(panelTransition)
            }
        }
        .padding(.leading, 56)
        .padding(.trailing, Spacing.small)
        .padding(.bottom, store.isShowingComposerPanel ? Spacing.xSmall : 0)
        .animation(panelAnimation, value: store.isChoosingContext)
        .animation(panelAnimation, value: store.isShowingSlashMenu)
    }

    private var panelAnimation: Animation {
        reduceMotion
            ? .easeOut(duration: 0.12)
            : .snappy(duration: 0.24, extraBounce: 0)
    }

    private var panelTransition: AnyTransition {
        guard !reduceMotion else { return .opacity }
        return .asymmetric(
            insertion: .opacity
                .combined(with: .scale(scale: 0.985, anchor: .bottom))
                .combined(with: .offset(x: 0, y: 6)),
            removal: .opacity
                .combined(with: .scale(scale: 0.99, anchor: .bottom))
        )
    }
}
