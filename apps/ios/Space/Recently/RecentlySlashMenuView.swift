import SpaceUI
import SwiftUI

struct RecentlySlashMenuView: View {
    let commands: [RecentlySlashCommand]
    let onSelect: (RecentlySlashCommand) -> Void

    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    private let rowHeight: CGFloat = 44

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(Array(commands.enumerated()), id: \.element.id) { index, command in
                    commandRow(command)
                        .overlay(alignment: .bottom) {
                            if index < commands.count - 1 {
                                Divider()
                                    .padding(.leading, 40)
                            }
                        }
                }
            }
        }
        .scrollIndicators(.hidden)
        .frame(height: min(CGFloat(commands.count) * rowHeight, rowHeight * 5))
        .background {
            let shape = RoundedRectangle(cornerRadius: Radius.sheet, style: .continuous)
            if reduceTransparency {
                shape.fill(Color(SpacePalette.surface))
            } else {
                shape
                    .fill(.clear)
                    .glassEffect(.regular, in: shape)
            }
        }
        .clipShape(.rect(cornerRadius: Radius.sheet, style: .continuous))
        .accessibilityIdentifier("recently.composer.slash.menu")
    }

    private func commandRow(_ command: RecentlySlashCommand) -> some View {
        Button {
            onSelect(command)
        } label: {
            HStack(spacing: Spacing.small) {
                Image(systemName: command.systemImage)
                    .font(.system(size: 17, weight: .medium))
                    .foregroundStyle(Color(SpacePalette.accent))
                    .frame(width: 24)

                HStack(alignment: .firstTextBaseline, spacing: 5) {
                    Text(command.title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color(SpacePalette.primary))
                    Text(command.summary)
                        .font(.caption)
                        .foregroundStyle(Color(SpacePalette.subtle))
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                Image(systemName: "chevron.right")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(Color(SpacePalette.subtle).opacity(0.72))
            }
            .padding(.horizontal, Spacing.medium)
            .frame(height: rowHeight)
            .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("recently.composer.slash.\(command.rawValue)")
        .accessibilityLabel("\(command.title), \(command.summary)")
        .accessibilityHint("Opens the corresponding search")
    }
}
