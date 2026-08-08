import SpaceCore
import SpaceUI
import SwiftUI

struct ActivityFeedCard: View {
    private struct Event: Identifiable {
        enum Kind { case comment, like }

        let id: String
        let kind: Kind
        let title: String
        let detail: String
        let date: Date
    }

    let recent: Components.Schemas.RecentActivities
    var limit = 8

    private var events: [Event] {
        let comments = recent.comment.enumerated().map { index, item in
            Event(
                id: "comment-\(item.id ?? String(index))",
                kind: .comment,
                title: "\(item.author) commented",
                detail: item.title ?? item.text,
                date: item.createdAt
            )
        }
        let likes = recent.like.map {
            Event(
                id: "like-\($0.id)",
                kind: .like,
                title: "New like",
                detail: $0.title ?? "Published content",
                date: $0.createdAt
            )
        }
        return Array((comments + likes).sorted { $0.date > $1.date }.prefix(limit))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.regular) {
            Text("Recent activity").font(.headline)
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
                            .accessibilityHidden(true)
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
                    .accessibilityElement(children: .combine)
                }
            }
        }
        .padding(Spacing.regular)
        .background(.background, in: .rect(cornerRadius: Radius.card))
        .accessibilityIdentifier("activity.recent")
    }
}
