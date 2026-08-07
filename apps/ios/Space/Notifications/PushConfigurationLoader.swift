import Foundation
import SpaceCore

enum PushConfigurationLoader {
    static func bundled(_ bundle: Bundle = .main) -> PushConfiguration? {
        guard
            let relayValue = bundle.object(forInfoDictionaryKey: "SpacePushRelayURL") as? String,
            let appIDValue = bundle.object(forInfoDictionaryKey: "SpacePushAppID") as? String,
            let environmentValue = bundle.object(forInfoDictionaryKey: "SpaceAPNsEnvironment") as? String
        else { return nil }

        let relay = relayValue.trimmingCharacters(in: .whitespacesAndNewlines)
        let appID = appIDValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard
            !relay.isEmpty,
            !relay.contains("$("),
            let relayURL = URL(string: relay),
            let environment = PushConfiguration.APNsEnvironment(rawValue: environmentValue)
        else { return nil }
        return try? PushConfiguration(relayURL: relayURL, appID: appID, environment: environment)
    }
}
