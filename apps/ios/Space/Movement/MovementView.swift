import Charts
import SpaceCore
import SpaceUI
import SwiftUI

struct MovementView: View {
    enum Range: String, CaseIterable, Identifiable {
        case day = "24H"
        case week = "7D"
        case month = "30D"

        var id: Self { self }
    }

    @State var store: MovementStore
    @State private var range: Range = .day

    let openWebAnalytics: () -> Void

    var body: some View {
        ScrollView {
            switch store.state {
            case .idle, .loading:
                ProgressView().padding(.top, Spacing.section)
            case let .failed(message):
                ContentUnavailableView(
                    "Movement unavailable",
                    systemImage: "chart.xyaxis.line",
                    description: Text(message)
                )
                .padding(.top, Spacing.section)
            case let .loaded(snapshot):
                content(snapshot)
            }
        }
        .background(Color(.systemGroupedBackground))
        .accessibilityIdentifier("movement.scroll")
        .refreshable { await store.load() }
        .task { await store.load() }
    }

    private func content(_ snapshot: MovementSnapshot) -> some View {
        LazyVStack(alignment: .leading, spacing: Spacing.loose) {
            Picker("Range", selection: $range) {
                ForEach(Range.allCases) { range in
                    Text(range.rawValue).tag(range)
                }
            }
            .pickerStyle(.segmented)

            MovementChartCard(snapshot: snapshot, range: range)
            TopReadingCard(items: snapshot.topReadings)
            RecentMovementCard(recent: snapshot.recent)

            Button("View full analytics on Web", systemImage: "safari") {
                openWebAnalytics()
            }
            .buttonStyle(.bordered)
            .frame(maxWidth: .infinity)
        }
        .padding(Spacing.regular)
    }
}

private struct MovementPoint: Identifiable {
    let label: String
    let value: Int
    var id: String { label }
}

private struct MovementChartCard: View {
    let snapshot: MovementSnapshot
    let range: MovementView.Range

    private var points: [MovementPoint] {
        switch range {
        case .day:
            snapshot.aggregate.today
                .filter { $0.key == .pv }
                .map { MovementPoint(label: $0.hour, value: $0.value) }
        case .week:
            snapshot.aggregate.weeks
                .filter { $0.key == .pv }
                .map { MovementPoint(label: $0.day, value: $0.value) }
        case .month:
            snapshot.aggregate.months
                .filter { $0.key == .pv }
                .map { MovementPoint(label: $0.date, value: $0.value) }
        }
    }

    private var todayViews: Int {
        snapshot.aggregate.today.filter { $0.key == .pv }.reduce(0) { $0 + $1.value }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.regular) {
            Text("Pageviews").font(.subheadline).foregroundStyle(.secondary)
            Text(points.reduce(0) { $0 + $1.value }, format: .number)
                .font(.largeTitle.weight(.semibold))
                .monospacedDigit()

            Chart(points) { point in
                AreaMark(
                    x: .value("Time", point.label),
                    y: .value("Pageviews", point.value)
                )
                .foregroundStyle(.tint.opacity(0.12))
                LineMark(
                    x: .value("Time", point.label),
                    y: .value("Pageviews", point.value)
                )
                .foregroundStyle(.tint)
                .interpolationMethod(.catmullRom)
            }
            .chartYAxis(.hidden)
            .chartXAxis {
                AxisMarks(values: .automatic(desiredCount: 4))
            }
            .frame(height: 150)
            .accessibilityLabel("Pageviews trend")

            HStack {
                metric(todayViews, "Today")
                Spacer()
                metric(snapshot.aggregate.todayIps.count, "Visitors")
                Spacer()
                metric(snapshot.aggregate.total.uv, "All-time UV")
            }
        }
        .padding(Spacing.regular)
        .background(.background, in: .rect(cornerRadius: Radius.card))
        .accessibilityIdentifier("movement.chart")
    }

    private func metric(_ value: Int, _ label: String) -> some View {
        VStack(alignment: .leading, spacing: Spacing.hairline) {
            Text(value, format: .number).font(.headline).monospacedDigit()
            Text(label).font(.caption).foregroundStyle(.secondary)
        }
    }
}

private struct TopReadingCard: View {
    let items: [Components.Schemas.ReadingRank]

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.regular) {
            Text("Top content").font(.headline)
            if items.isEmpty {
                Text("No reading activity yet")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(Array(items.enumerated()), id: \.element.refId) { index, item in
                    HStack(spacing: Spacing.regular) {
                        Text(index + 1, format: .number)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                            .frame(width: 18)
                        Text(item.ref?.title ?? "Untitled content")
                            .font(.subheadline)
                            .lineLimit(1)
                        Spacer()
                        Text("\(item.count) reads")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    if index < items.count - 1 { Divider() }
                }
            }
        }
        .padding(Spacing.regular)
        .background(.background, in: .rect(cornerRadius: Radius.card))
    }
}

private struct MovementEvent: Identifiable {
    enum Kind { case comment, like }

    let id: String
    let kind: Kind
    let title: String
    let detail: String
    let date: Date
}

private struct RecentMovementCard: View {
    let recent: Components.Schemas.RecentActivities

    private var events: [MovementEvent] {
        let comments = recent.comment.map {
            MovementEvent(
                id: "comment-\($0.id ?? $0.createdAt.timeIntervalSince1970.description)",
                kind: .comment,
                title: "\($0.author) commented",
                detail: $0.title ?? $0.text,
                date: $0.createdAt
            )
        }
        let likes = recent.like.map {
            MovementEvent(
                id: "like-\($0.id)",
                kind: .like,
                title: "New like",
                detail: $0.title ?? "Published content",
                date: $0.createdAt
            )
        }
        return (comments + likes).sorted { $0.date > $1.date }.prefix(8).map(\.self)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.regular) {
            Text("Recent movement").font(.headline)
            if events.isEmpty {
                Text("No recent activity")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(events) { event in
                    HStack(alignment: .top, spacing: Spacing.regular) {
                        Image(systemName: event.kind == .like ? "heart.fill" : "bubble.left.fill")
                            .foregroundStyle(event.kind == .like ? Color.pink : Color.accentColor)
                            .frame(width: 24)
                        VStack(alignment: .leading, spacing: Spacing.hairline) {
                            Text(event.title).font(.subheadline.weight(.medium))
                            Text(event.detail)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .lineLimit(2)
                        }
                        Spacer(minLength: 0)
                        Text(event.date, format: .relative(presentation: .named))
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }
                }
            }
        }
        .padding(Spacing.regular)
        .background(.background, in: .rect(cornerRadius: Radius.card))
        .accessibilityIdentifier("movement.recent")
    }
}
