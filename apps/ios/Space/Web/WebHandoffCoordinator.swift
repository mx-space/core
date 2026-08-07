import SafariServices
import SpaceCore
import UIKit

@MainActor
final class WebHandoffCoordinator {
    private let service: WebHandoffService

    init(service: WebHandoffService) {
        self.service = service
    }

    func open(_ target: WebHandoffTarget, from presenter: UIViewController) {
        Task {
            do {
                let url = try await service.makeURL(for: target)
                let browser = SFSafariViewController(url: url)
                browser.dismissButtonStyle = .close
                presenter.present(browser, animated: true)
            } catch {
                let alert = UIAlertController(
                    title: "Could not open Web Admin",
                    message: error.localizedDescription,
                    preferredStyle: .alert
                )
                alert.addAction(UIAlertAction(title: "OK", style: .default))
                presenter.present(alert, animated: true)
            }
        }
    }
}
