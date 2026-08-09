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

    let recent: Components.Schemas.RecentActivities?
    var limit = 8

    private var events: [Event] {
        guard let recent else { return [] }
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
        VStack(alignment: .leading, spacing: Spacing.medium) {
            Text("Activity").font(.headline)

            if events.isEmpty {
                Text("No recent activity")
                    .font(.subheadline)
                    .foregroundStyle(Color(SpacePalette.muted))
            } else {
                ForEach(Array(events.enumerated()), id: \.element.id) { index, event in
                    if index > 0 { Divider() }
                    HStack(alignment: .top, spacing: Spacing.medium) {
                        Image(systemName: event.kind == .like ? "hand.thumbsup.fill" : "bubble.left.fill")
                            .foregroundStyle(
                                event.kind == .like
                                    ? Color(SpacePalette.success)
                                    : Color(SpacePalette.accent)
                            )
                            .frame(width: 24)
                            .accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: Spacing.xSmall) {
                            Text(event.title).font(.subheadline.weight(.medium))
                            Text(event.detail)
                                .font(.caption)
                                .foregroundStyle(Color(SpacePalette.muted))
                                .lineLimit(2)
                        }
                        Spacer(minLength: 0)
                        Text(event.date, format: .relative(presentation: .named))
                            .font(.caption2)
                            .foregroundStyle(Color(SpacePalette.subtle))
                    }
                    .accessibilityElement(children: .combine)
                }
            }
        }
        .accessibilityIdentifier("activity.recent")
    }
}
