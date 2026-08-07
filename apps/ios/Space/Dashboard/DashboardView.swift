import SpaceCore
import SpaceUI
import SwiftUI

struct DashboardView: View {
    @State var store: DashboardStore

    let openWeb: (WebHandoffTarget) -> Void
    let openMovement: () -> Void
    let openInbox: () -> Void

    var body: some View {
        ScrollView {
            switch store.state {
            case .idle, .loading:
                ProgressView()
                    .padding(.top, Spacing.section)
            case let .failed(message):
                ContentUnavailableView(
                    "Could not load",
                    systemImage: "exclamationmark.triangle",
                    description: Text(message)
                )
                .padding(.top, Spacing.section)
            case let .loaded(snapshot):
                content(snapshot)
            }
        }
        .background(Color(.systemGroupedBackground))
        .accessibilityIdentifier("dashboard.scroll")
        .refreshable { await store.load() }
        .task { await store.load() }
    }

    private func content(_ snapshot: DashboardSnapshot) -> some View {
        LazyVStack(alignment: .leading, spacing: Spacing.loose) {
            StatusHeader(stat: snapshot.stat)
            if snapshot.desk.unreadComments.count > 0 || snapshot.desk.linkApplications.count > 0 {
                AttentionCard(
                    desk: snapshot.desk,
                    openComments: openInbox,
                    openLinkApplications: { openWeb(.admin) }
                )
            }
            TodayMetrics(stat: snapshot.stat, openMovement: openMovement)
            if !snapshot.desk.scheduledNotes.isEmpty {
                ScheduledCard(notes: snapshot.desk.scheduledNotes) {
                    openWeb(.notes)
                }
            }
            if let recent = snapshot.recent {
                ActivityFeedCard(recent: recent, limit: 3)
            }
            Button("Open full Web Admin", systemImage: "safari") {
                openWeb(.admin)
            }
            .buttonStyle(.bordered)
            .frame(maxWidth: .infinity)
            .accessibilityIdentifier("dashboard.web.admin")

            if let refreshError = store.refreshError {
                Label(refreshError, systemImage: "exclamationmark.triangle")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(Spacing.regular)
    }
}

private struct StatusHeader: View {
    let stat: Components.Schemas.Stat

    var body: some View {
        HStack(spacing: Spacing.tight) {
            Image(systemName: "circle.fill")
                .font(.caption2)
                .foregroundStyle(stat.online > 0 ? .green : .secondary)
            Text(stat.online > 0 ? "Your site is active" : "No visitors online")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Spacer()
            Text("\(stat.online) online")
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}

private struct TodayMetrics: View {
    let stat: Components.Schemas.Stat
    let openMovement: () -> Void

    var body: some View {
        Button(action: openMovement) {
            VStack(alignment: .leading, spacing: Spacing.regular) {
                HStack {
                    Text("Today").font(.headline)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.tertiary)
                }
                HStack(spacing: 0) {
                    metric(value: stat.todayIpAccessCount, label: "Visitors")
                    Divider().frame(height: 42)
                    metric(value: stat.todayOnlineTotal, label: "Sessions")
                    Divider().frame(height: 42)
                    metric(value: stat.online, label: "Online")
                }
            }
            .padding(Spacing.regular)
            .background(.background, in: .rect(cornerRadius: Radius.card))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("dashboard.counters")
    }

    private func metric(value: Int, label: String) -> some View {
        VStack(spacing: Spacing.hairline) {
            Text(value, format: .number)
                .font(.title3.weight(.semibold))
                .monospacedDigit()
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }

    private func metric(value: String, label: String) -> some View {
        VStack(spacing: Spacing.hairline) {
            Text(value)
                .font(.title3.weight(.semibold))
                .monospacedDigit()
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }
}

private struct AttentionCard: View {
    let desk: Components.Schemas.Desk
    let openComments: () -> Void
    let openLinkApplications: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.regular) {
            Text("Needs attention").font(.headline)
            if desk.unreadComments.count > 0 {
                Button(action: openComments) {
                    HStack(alignment: .top, spacing: Spacing.regular) {
                        Image(systemName: "bubble.left.and.exclamationmark.bubble.right")
                            .font(.title3)
                            .foregroundStyle(.tint)
                        VStack(alignment: .leading, spacing: Spacing.hairline) {
                            Text("Unread comments")
                                .font(.subheadline.weight(.medium))
                            if let latest = desk.unreadComments.latest {
                                Text("\(latest.author): \(latest.text)")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(2)
                            }
                        }
                        Spacer(minLength: 0)
                        Text(desk.unreadComments.count, format: .number)
                            .font(.title3.weight(.semibold))
                            .monospacedDigit()
                        Image(systemName: "chevron.right")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.tertiary)
                    }
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("dashboard.unreadComments")
            }

            if desk.linkApplications.count > 0 {
                if desk.unreadComments.count > 0 { Divider() }
                Button(action: openLinkApplications) {
                    HStack {
                        Label(
                            "\(desk.linkApplications.count) link applications",
                            systemImage: "link.badge.plus"
                        )
                        Spacer()
                        Image(systemName: "safari")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .contentShape(.rect)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(Spacing.regular)
        .background(.background, in: .rect(cornerRadius: Radius.card))
    }
}

private struct ScheduledCard: View {
    let notes: [Components.Schemas.Desk.ScheduledNotesPayloadPayload]
    let openNotes: () -> Void

    var body: some View {
        Button(action: openNotes) {
            VStack(alignment: .leading, spacing: Spacing.tight) {
                HStack {
                    Text("Scheduled").font(.headline)
                    Spacer()
                    Text("Manage on Web")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                ForEach(notes.prefix(3), id: \.id) { note in
                    HStack {
                        Text(note.title ?? "Untitled").lineLimit(1)
                        Spacer()
                        Text(note.publicAt)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .padding(Spacing.regular)
            .background(.background, in: .rect(cornerRadius: Radius.card))
        }
        .buttonStyle(.plain)
    }
}
