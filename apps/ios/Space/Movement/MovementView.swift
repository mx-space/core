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

        var days: Int {
            switch self {
            case .day: 1
            case .week: 7
            case .month: 30
            }
        }

        var title: String {
            switch self {
            case .day: "Last 24 hours"
            case .week: "Last 7 days"
            case .month: "Last 30 days"
            }
        }
    }

    @State var store: MovementStore
    @State private var range: Range = .day

    let openWebAnalytics: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            Picker("Range", selection: $range) {
                ForEach(Range.allCases) { range in
                    Text(range.rawValue).tag(range)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, Spacing.regular)
            .padding(.vertical, Spacing.tight)
            .background(.bar)

            Divider()

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
            .refreshable { await store.load(days: range.days) }
        }
        .background(Color(.systemGroupedBackground))
        .accessibilityIdentifier("movement.scroll")
        .task { await store.load(days: range.days) }
        .onChange(of: range) { _, newRange in
            Task { await store.load(days: newRange.days) }
        }
    }

    private func content(_ snapshot: MovementSnapshot) -> some View {
        LazyVStack(alignment: .leading, spacing: Spacing.loose) {
            MovementChartCard(snapshot: snapshot, range: range, isRefreshing: store.isRefreshing)
            TopReadingCard(items: snapshot.topReadings)
            ActivityFeedCard(recent: snapshot.recent)

            Button("View full analytics on Web", systemImage: "safari") {
                openWebAnalytics()
            }
            .buttonStyle(.bordered)
            .frame(maxWidth: .infinity)

            if let refreshError = store.refreshError {
                Label(refreshError, systemImage: "exclamationmark.triangle")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
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
    let isRefreshing: Bool

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
            HStack {
                Text("Pageviews · \(range.title)")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Spacer()
                if isRefreshing {
                    ProgressView().controlSize(.small)
                }
            }
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
                metric(todayViews, "Views today")
                Spacer()
                metric(snapshot.aggregate.todayIps.count, "Visitors today")
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
