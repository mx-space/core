import SpaceCore
import SpaceUI
import SwiftUI

struct DashboardView: View {
    @State var store: DashboardStore

    let scrollToTopSignal: ScrollToTopSignal
    let openWeb: (WebHandoffTarget) -> Void
    let openMovement: () -> Void
    let openInbox: () -> Void

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                Color.clear
                    .frame(height: 1)
                    .id("dashboard.top")

                switch store.state {
                case .idle, .loading:
                    DashboardSkeleton()
                case let .failed(message):
                    failedState(message)
                case let .loaded(snapshot):
                    content(snapshot)
                }
            }
            .onChange(of: scrollToTopSignal.requestID) { _, _ in
                withAnimation(.snappy) {
                    proxy.scrollTo("dashboard.top", anchor: .top)
                }
            }
        }
        .background(Color(SpacePalette.page))
        .accessibilityIdentifier("dashboard.scroll")
        .refreshable { await store.load() }
        .task { await store.load() }
    }

    private func content(_ snapshot: DashboardSnapshot) -> some View {
        LazyVStack(alignment: .leading, spacing: Spacing.large) {
            DashboardContext(stat: snapshot.stat)

            if hasAttention(snapshot.desk) {
                AttentionCard(
                    desk: snapshot.desk,
                    openComments: openInbox,
                    openLinkApplications: { openWeb(.admin) }
                )
            } else {
                Label("All caught up", systemImage: "checkmark.circle.fill")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Color(SpacePalette.success))
                    .accessibilityIdentifier("dashboard.allCaughtUp")
            }

            AtAGlanceCard(stat: snapshot.stat, openMovement: openMovement)
            ScheduledSection(notes: snapshot.desk.scheduledNotes) {
                openWeb(.notes)
            }
            ActivityFeedCard(recent: snapshot.recent, limit: 5)

            if let refreshError = store.refreshError {
                Label(refreshError, systemImage: "exclamationmark.triangle")
                    .font(.caption)
                    .foregroundStyle(Color(SpacePalette.warning))
                    .accessibilityIdentifier("dashboard.refreshError")
            }
        }
        .padding(.horizontal, Spacing.regular)
        .padding(.bottom, Spacing.section)
    }

    private func failedState(_ message: String) -> some View {
        ContentUnavailableView {
            Label("Could not load Today", systemImage: "exclamationmark.triangle")
        } description: {
            Text(message)
        } actions: {
            Button("Retry") { Task { await store.load() } }
                .buttonStyle(.glassProminent)
        }
        .padding(.top, Spacing.section)
    }

    private func hasAttention(_ desk: Components.Schemas.Desk) -> Bool {
        desk.unreadComments.count > 0 || desk.linkApplications.count > 0
    }
}

private struct DashboardContext: View {
    let stat: Components.Schemas.Stat

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xSmall) {
            Text(Date.now, format: .dateTime.weekday(.wide).month(.wide).day())
                .font(.subheadline.weight(.medium))
                .foregroundStyle(Color(SpacePalette.muted))
            Text(
                stat.online > 0
                    ? "^[\(stat.online) visitor](inflect: true) online now"
                    : "No visitors online"
            )
            .font(.footnote)
            .foregroundStyle(Color(SpacePalette.subtle))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}

private struct AtAGlanceCard: View {
    let stat: Components.Schemas.Stat
    let openMovement: () -> Void

    var body: some View {
        Button(action: openMovement) {
            VStack(alignment: .leading, spacing: Spacing.regular) {
                HStack {
                    Text("At a glance")
                        .font(.headline)
                        .foregroundStyle(Color(SpacePalette.primary))
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Color(SpacePalette.subtle))
                }

                VStack(alignment: .leading, spacing: Spacing.xSmall) {
                    Text(stat.todayIpAccessCount, format: .number)
                        .font(.system(.largeTitle, design: .rounded, weight: .semibold))
                        .monospacedDigit()
                    Text("Visitors today")
                        .font(.subheadline)
                        .foregroundStyle(Color(SpacePalette.muted))
                }

                Divider()

                HStack(alignment: .top, spacing: Spacing.large) {
                    secondaryMetric(value: stat.todayOnlineTotal, label: "Sessions")
                    secondaryMetric(value: String(stat.online), label: "Online")
                }
            }
            .padding(Spacing.regular)
            .background(Color(SpacePalette.surface), in: .rect(cornerRadius: Radius.card))
            .overlay {
                RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
                    .stroke(Color(.separator).opacity(0.45), lineWidth: 0.5)
            }
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("dashboard.counters")
    }

    private func secondaryMetric(value: String, label: String) -> some View {
        VStack(alignment: .leading, spacing: Spacing.xSmall) {
            Text(value)
                .font(.headline)
                .monospacedDigit()
            Text(label)
                .font(.caption)
                .foregroundStyle(Color(SpacePalette.subtle))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct AttentionCard: View {
    let desk: Components.Schemas.Desk
    let openComments: () -> Void
    let openLinkApplications: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.medium) {
            Text("Needs attention")
                .font(.headline)

            if desk.unreadComments.count > 0 {
                Button(action: openComments) {
                    attentionRow(
                        icon: "bubble.left.and.exclamationmark.bubble.right",
                        title: "Unread comments",
                        detail: desk.unreadComments.latest.map { "\($0.author): \($0.text)" },
                        count: desk.unreadComments.count
                    )
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("dashboard.unreadComments")
            }

            if desk.linkApplications.count > 0 {
                if desk.unreadComments.count > 0 { Divider() }
                Button(action: openLinkApplications) {
                    attentionRow(
                        icon: "link.badge.plus",
                        title: "Link applications",
                        detail: "Review on Web",
                        count: desk.linkApplications.count
                    )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(Spacing.regular)
        .background(Color(SpacePalette.surface), in: .rect(cornerRadius: Radius.card))
        .overlay {
            RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
                .stroke(Color(.separator).opacity(0.45), lineWidth: 0.5)
        }
    }

    private func attentionRow(
        icon: String,
        title: String,
        detail: String?,
        count: Int
    ) -> some View {
        HStack(alignment: .top, spacing: Spacing.medium) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(Color(SpacePalette.accent))
                .frame(width: 24)
            VStack(alignment: .leading, spacing: Spacing.xSmall) {
                Text(title)
                    .font(.subheadline.weight(.medium))
                if let detail {
                    Text(detail)
                        .font(.caption)
                        .foregroundStyle(Color(SpacePalette.muted))
                        .lineLimit(2)
                }
            }
            Spacer(minLength: 0)
            Text(count, format: .number)
                .font(.headline)
                .monospacedDigit()
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(Color(SpacePalette.subtle))
        }
        .contentShape(.rect)
    }
}

private struct ScheduledSection: View {
    let notes: [Components.Schemas.Desk.ScheduledNotesPayloadPayload]
    let openNotes: () -> Void

    private static let isoFractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
    private static let iso = ISO8601DateFormatter()

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.medium) {
            HStack {
                Text("Scheduled").font(.headline)
                Spacer()
                Button(action: openNotes) {
                    Text("Manage")
                        .font(.subheadline.weight(.medium))
                        .frame(minHeight: 44)
                        .contentShape(.rect)
                }
                .buttonStyle(.plain)
                .foregroundStyle(Color(SpacePalette.accent))
            }

            if notes.isEmpty {
                Text("No scheduled content")
                    .font(.subheadline)
                    .foregroundStyle(Color(SpacePalette.muted))
            } else {
                ForEach(Array(notes.prefix(3).enumerated()), id: \.element.id) { index, note in
                    if index > 0 { Divider() }
                    Button(action: openNotes) {
                        HStack(spacing: Spacing.medium) {
                            Text(note.title ?? "Untitled")
                                .font(.subheadline)
                                .lineLimit(1)
                            Spacer()
                            publishDate(note.publicAt)
                                .font(.caption)
                                .foregroundStyle(Color(SpacePalette.subtle))
                        }
                        .contentShape(.rect)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func publishDate(_ raw: String) -> Text {
        guard let date = Self.isoFractional.date(from: raw) ?? Self.iso.date(from: raw) else {
            return Text(raw)
        }
        return Text(date, format: .relative(presentation: .named))
    }
}

private struct DashboardSkeleton: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.large) {
            Text("Saturday, August 9\nNo visitors online")
            RoundedRectangle(cornerRadius: Radius.card)
                .frame(height: 190)
            Text("Scheduled")
            ForEach(0..<3, id: \.self) { _ in
                RoundedRectangle(cornerRadius: 4).frame(height: 18)
            }
            Text("Activity")
            ForEach(0..<2, id: \.self) { _ in
                RoundedRectangle(cornerRadius: 4).frame(height: 36)
            }
        }
        .padding(.horizontal, Spacing.regular)
        .foregroundStyle(Color(SpacePalette.inset))
        .redacted(reason: .placeholder)
        .accessibilityLabel("Loading Today")
    }
}
