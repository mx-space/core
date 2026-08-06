import SpaceCore
import SpaceUI
import SwiftUI

struct DashboardView: View {
    @State var store: DashboardStore

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
        .accessibilityIdentifier("dashboard.scroll")
        .refreshable { await store.load() }
        .task { await store.load() }
    }

    @ViewBuilder
    private func content(_ snapshot: DashboardSnapshot) -> some View {
        VStack(alignment: .leading, spacing: Spacing.loose) {
            InboxCard(desk: snapshot.desk)
            CountersGrid(stat: snapshot.stat)
            ScheduledList(notes: snapshot.desk.scheduledNotes)
        }
        .padding(Spacing.regular)
    }
}

private struct InboxCard: View {
    let desk: Components.Schemas.Desk

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.regular) {
            Text("Needs attention")
                .font(.headline)

            row(
                title: "Unread comments",
                count: desk.unreadComments.count,
                detail: desk.unreadComments.latest.map { "\($0.author): \($0.text)" }
            )
            .accessibilityIdentifier("dashboard.unreadComments")

            Divider()

            row(
                title: "Link applications",
                count: desk.linkApplications.count,
                detail: desk.linkApplications.latest?.name
            )
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.regular)
        .background(
            RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
                .fill(Color(.secondarySystemBackground))
        )
    }

    private func row(title: String, count: Int, detail: String?) -> some View {
        VStack(alignment: .leading, spacing: Spacing.hairline) {
            HStack {
                Text(title)
                Spacer()
                Text("\(count)").monospacedDigit().fontWeight(.semibold)
            }
            if let detail {
                Text(detail)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
        }
    }
}

private struct CountersGrid: View {
    let stat: Components.Schemas.Stat

    private var entries: [(String, Int)] {
        [
            ("Posts", stat.posts),
            ("Notes", stat.notes),
            ("Comments", stat.allComments),
            ("Says", stat.says),
            ("Online", stat.online),
            ("Today UV", stat.todayIpAccessCount),
        ]
    }

    var body: some View {
        LazyVGrid(
            columns: [GridItem(.adaptive(minimum: 100), spacing: Spacing.regular)],
            spacing: Spacing.regular
        ) {
            ForEach(entries, id: \.0) { entry in
                VStack(spacing: Spacing.tight) {
                    Text("\(entry.1)")
                        .font(.title2)
                        .monospacedDigit()
                    Text(entry.0)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, Spacing.regular)
                .background(
                    RoundedRectangle(cornerRadius: Radius.control, style: .continuous)
                        .fill(Color(.secondarySystemBackground))
                )
            }
        }
        .accessibilityIdentifier("dashboard.counters")
    }
}

private struct ScheduledList: View {
    let notes: [Components.Schemas.Desk.ScheduledNotesPayloadPayload]

    var body: some View {
        if !notes.isEmpty {
            VStack(alignment: .leading, spacing: Spacing.tight) {
                Text("Scheduled")
                    .font(.headline)
                ForEach(notes, id: \.id) { note in
                    HStack {
                        Text(note.title ?? "Untitled")
                            .lineLimit(1)
                        Spacer()
                        Text(note.publicAt)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Spacing.regular)
            .background(
                RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
                    .fill(Color(.secondarySystemBackground))
            )
        }
    }
}
