import Charts
import SpaceCore
import SpaceUI
import SwiftUI

struct MovementView: View {
    enum Range: String, CaseIterable, Identifiable {
        case day = "Today"
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
            case .day: "Today"
            case .week: "Last 7 days"
            case .month: "Last 30 days"
            }
        }
    }

    @State var store: MovementStore
    @State private var range: Range = .day

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: Spacing.large) {
                Picker("Range", selection: $range) {
                    ForEach(Range.allCases) { range in
                        Text(range.rawValue).tag(range)
                    }
                }
                .pickerStyle(.segmented)

                switch store.state {
                case .idle, .loading:
                    MovementSkeleton()
                case let .failed(message):
                    failedState(message)
                case let .loaded(snapshot):
                    MovementChartCard(
                        snapshot: snapshot,
                        range: range,
                        isRefreshing: store.isRefreshing
                    )
                    TopReadingSection(items: snapshot.topReadings)

                    if let refreshError = store.refreshError {
                        Label(refreshError, systemImage: "exclamationmark.triangle")
                            .font(.caption)
                            .foregroundStyle(Color(SpacePalette.warning))
                    }
                }
            }
            .padding(.horizontal, Spacing.regular)
            .padding(.top, Spacing.medium)
            .padding(.bottom, Spacing.section)
        }
        .background(Color(SpacePalette.page))
        .accessibilityIdentifier("movement.scroll")
        .refreshable { await store.load(days: range.days) }
        .task { await store.load(days: range.days) }
        .onChange(of: range) { _, newRange in
            Task { await store.load(days: newRange.days) }
        }
    }

    private func failedState(_ message: String) -> some View {
        ContentUnavailableView {
            Label("Movement unavailable", systemImage: "chart.xyaxis.line")
        } description: {
            Text(message)
        } actions: {
            Button("Retry") { Task { await store.load(days: range.days) } }
                .buttonStyle(.glassProminent)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, Spacing.large)
    }
}

private struct MovementPoint: Identifiable, Equatable {
    let label: String
    let value: Int
    var id: String { label }
}

private struct MovementChartCard: View {
    let snapshot: MovementSnapshot
    let range: MovementView.Range
    let isRefreshing: Bool

    @State private var selectedLabel: String?

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

    private var selectedPoint: MovementPoint? {
        selectedLabel.flatMap { label in points.first { $0.label == label } }
    }

    private var total: Int {
        points.reduce(0) { $0 + $1.value }
    }

    private var maximum: Int {
        max(1, points.map(\.value).max() ?? 0)
    }

    private var isEmpty: Bool {
        points.allSatisfy { $0.value == 0 }
    }

    /// Swift Charts treats the string-based time values as categorical data.
    /// Its automatic axis therefore emits every category, even when a desired
    /// count is supplied. Sample the domain explicitly so compact screens keep
    /// a readable axis while always retaining both range endpoints.
    private var xAxisLabels: [String] {
        let targetCount = switch range {
        case .day: 5
        case .week: 4
        case .month: 5
        }

        guard points.count > targetCount, targetCount > 1 else {
            return points.map(\.label)
        }

        let lastIndex = points.count - 1
        return (0 ..< targetCount).map { position in
            let progress = Double(position) / Double(targetCount - 1)
            let index = Int((progress * Double(lastIndex)).rounded())
            return points[index].label
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.regular) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: Spacing.xSmall) {
                    Text("Pageviews")
                        .font(.subheadline)
                        .foregroundStyle(Color(SpacePalette.muted))
                    Text(selectedPoint?.value ?? total, format: .number)
                        .font(.system(.largeTitle, design: .rounded, weight: .semibold))
                        .monospacedDigit()
                    Text(selectedPoint?.label ?? range.title)
                        .font(.caption)
                        .foregroundStyle(Color(SpacePalette.subtle))
                }
                Spacer()
                if isRefreshing {
                    ProgressView()
                        .controlSize(.small)
                        .accessibilityLabel("Refreshing Movement")
                }
            }

            Chart(points) { point in
                AreaMark(
                    x: .value("Time", point.label),
                    y: .value("Pageviews", point.value)
                )
                .interpolationMethod(.monotone)
                .foregroundStyle(
                    .linearGradient(
                        colors: [
                            Color(SpacePalette.accent).opacity(0.22),
                            Color(SpacePalette.accent).opacity(0.02),
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )

                LineMark(
                    x: .value("Time", point.label),
                    y: .value("Pageviews", point.value)
                )
                .foregroundStyle(Color(SpacePalette.accent))
                .lineStyle(StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
                .interpolationMethod(.monotone)

                if selectedPoint == point {
                    RuleMark(x: .value("Selected time", point.label))
                        .foregroundStyle(Color(SpacePalette.subtle).opacity(0.5))
                    PointMark(
                        x: .value("Time", point.label),
                        y: .value("Pageviews", point.value)
                    )
                    .foregroundStyle(Color(SpacePalette.accent))
                    .symbolSize(36)
                }
            }
            .chartYScale(domain: 0 ... maximum)
            .chartXScale(range: .plotDimension(startPadding: 20, endPadding: 20))
            .chartXAxis {
                AxisMarks(values: xAxisLabels) { value in
                    AxisGridLine().foregroundStyle(Color(.separator).opacity(0.35))
                    AxisValueLabel {
                        if let label = value.as(String.self) {
                            Text(label.replacingOccurrences(of: "-", with: "/"))
                                .font(.caption2)
                                .monospacedDigit()
                                .foregroundStyle(Color(SpacePalette.subtle))
                        }
                    }
                }
            }
            .chartYAxis {
                AxisMarks(position: .leading, values: .automatic(desiredCount: 3)) {
                    AxisGridLine().foregroundStyle(Color(.separator).opacity(0.35))
                    AxisValueLabel().foregroundStyle(Color(SpacePalette.subtle))
                }
            }
            .chartXSelection(value: $selectedLabel)
            .frame(height: 180)
            .overlay {
                if isEmpty {
                    Text("No pageviews in this range")
                        .font(.caption)
                        .foregroundStyle(Color(SpacePalette.subtle))
                }
            }
            .accessibilityLabel("Pageviews trend")

            Divider()

            HStack(spacing: 0) {
                metric(snapshot.aggregate.todayIps.count, "Unique today")
                Divider().frame(height: 40)
                metric(snapshot.aggregate.total.uv, "All-time UV")
            }
        }
        .padding(Spacing.regular)
        .background(Color(SpacePalette.surface), in: .rect(cornerRadius: Radius.card))
        .overlay {
            RoundedRectangle(cornerRadius: Radius.card, style: .continuous)
                .stroke(Color(.separator).opacity(0.45), lineWidth: 0.5)
        }
        .accessibilityIdentifier("movement.chart")
        .onChange(of: range) { _, _ in selectedLabel = nil }
    }

    private func metric(_ value: Int, _ label: String) -> some View {
        VStack(alignment: .leading, spacing: Spacing.xSmall) {
            Text(value, format: .number)
                .font(.headline)
                .monospacedDigit()
            Text(label)
                .font(.caption)
                .foregroundStyle(Color(SpacePalette.subtle))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct TopReadingSection: View {
    let items: [Components.Schemas.ReadingRank]

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.medium) {
            Text("Top content").font(.headline)
            if items.isEmpty {
                Text("No reading activity yet")
                    .font(.subheadline)
                    .foregroundStyle(Color(SpacePalette.muted))
            } else {
                ForEach(Array(items.enumerated()), id: \.element.refId) { index, item in
                    if index > 0 { Divider() }
                    HStack(spacing: Spacing.medium) {
                        Text(index + 1, format: .number)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Color(SpacePalette.subtle))
                            .frame(width: 20, alignment: .leading)
                        Text(item.ref?.title ?? "Untitled content")
                            .font(.subheadline)
                            .lineLimit(2)
                        Spacer(minLength: Spacing.small)
                        Text("\(item.count) reads")
                            .font(.caption)
                            .foregroundStyle(Color(SpacePalette.muted))
                            .monospacedDigit()
                    }
                }
            }
        }
    }
}

private struct MovementSkeleton: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.regular) {
            RoundedRectangle(cornerRadius: Radius.card).frame(height: 310)
            Text("Top content")
            ForEach(0..<4, id: \.self) { _ in
                RoundedRectangle(cornerRadius: 4).frame(height: 24)
            }
        }
        .foregroundStyle(Color(SpacePalette.inset))
        .redacted(reason: .placeholder)
        .accessibilityLabel("Loading Movement")
    }
}
