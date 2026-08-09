import SpaceUI
import SwiftUI

struct SiteSettingsView: View {
    let host: String
    let pushManager: PushNotificationManager?

    @State private var confirmUnpair = false

    var body: some View {
        Form {
            Section("Site") {
                LabeledContent("Host") {
                    Text(host)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.trailing)
                        .textSelection(.enabled)
                }
                LabeledContent("Status", value: "Paired")
            }

            if let pushManager {
                NotificationSettingsSection(manager: pushManager)
            }

            Section("About") {
                LabeledContent("Version", value: version)
                LabeledContent("Build", value: build)
            }

            Section {
                Button(role: .destructive) {
                    confirmUnpair = true
                } label: {
                    Label("Unpair from this site", systemImage: "rectangle.portrait.and.arrow.right")
                        .foregroundStyle(Color(SpacePalette.danger))
                }
            } footer: {
                Text("Unpairing removes this site's address and credentials from this iPhone only. It does not delete data from the server.")
            }
        }
        .navigationTitle("Site Settings")
        .navigationBarTitleDisplayMode(.inline)
        .alert("Unpair from this site?", isPresented: $confirmUnpair) {
            Button("Cancel", role: .cancel) {}
            Button("Unpair", role: .destructive) {
                AppContainer.shared.unpair()
            }
        } message: {
            Text("Space will forget this server and its local credentials. Server data will not be changed.")
        }
    }

    private var version: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "—"
    }

    private var build: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "—"
    }
}

private struct NotificationSettingsSection: View {
    @Bindable var manager: PushNotificationManager

    var body: some View {
        Section {
            if manager.isDenied {
                LabeledContent("New comments", value: "Disabled in iOS")
                Button("Open Settings", systemImage: "gear") {
                    manager.openSystemSettings()
                }
            } else {
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
            }

            if manager.isWorking {
                HStack(spacing: Spacing.small) {
                    ProgressView()
                    Text(manager.state == .disabling ? "Disabling…" : "Enabling…")
                        .foregroundStyle(.secondary)
                }
            }

            if let error = manager.errorMessage, !manager.isDenied {
                Label(error, systemImage: "exclamationmark.triangle")
                    .foregroundStyle(Color(SpacePalette.warning))
                Button("Retry") {
                    Task { await manager.enable() }
                }
                .buttonStyle(.glassProminent)
            }
        } header: {
            Text("Notifications")
        } footer: {
            Text("Alerts contain a generic message only. Comment text and visitor details remain on your server.")
        }
        .task { await manager.refresh() }
    }
}
