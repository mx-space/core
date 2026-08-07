import SpaceUI
import SwiftUI

struct NotificationSettingsView: View {
    @Bindable var manager: PushNotificationManager

    var body: some View {
        Form {
            Section {
                Toggle(
                    "New comments",
                    isOn: Binding(
                        get: { manager.isEnabled },
                        set: { enabled in
                            Task {
                                if enabled {
                                    await manager.enable()
                                } else {
                                    await manager.disable()
                                }
                            }
                        }
                    )
                )
                .disabled(manager.isWorking)
            } footer: {
                Text("Alerts contain only a generic message. Comment text and visitor details remain on your server.")
            }

            if manager.isWorking {
                HStack(spacing: Spacing.tight) {
                    ProgressView()
                    Text(manager.state == .disabling ? "Disabling…" : "Enabling…")
                        .foregroundStyle(.secondary)
                }
            }

            if let error = manager.errorMessage {
                Section("Status") {
                    Label(error, systemImage: "exclamationmark.triangle")
                        .foregroundStyle(.orange)
                }
            }
        }
        .navigationTitle("Notifications")
        .navigationBarTitleDisplayMode(.inline)
        .task { await manager.refresh() }
    }
}
