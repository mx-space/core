import SpaceCore
import SpaceUI
import UIKit

final class PairingCodeViewController: UIViewController {
    private let stepLabel = UILabel()
    private let codeLabel = UILabel()
    private let qrView = UIImageView()
    private let statusLabel = UILabel()
    private let copyButton = UIButton(configuration: .plain())
    private let openButton = PrimaryGlassButton(title: "Open approval page")
    private let retryButton = UIButton(configuration: .plain())
    private let spinner = UIActivityIndicatorView(style: .medium)

    private let endpoint: ServerEndpoint
    private let pairing: PairingService
    private let onPaired: () -> Void

    private var session: PairingSession?
    private var pollTask: Task<Void, Never>?

    init(endpoint: ServerEndpoint, pairing: PairingService, onPaired: @escaping () -> Void) {
        self.endpoint = endpoint
        self.pairing = pairing
        self.onPaired = onPaired
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    deinit { pollTask?.cancel() }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = "Pair"
        view.backgroundColor = .systemBackground

        stepLabel.text = "STEP 2 OF 2"
        stepLabel.font = .preferredFont(forTextStyle: .caption1)
        stepLabel.textColor = .secondaryLabel
        stepLabel.textAlignment = .center

        codeLabel.font = UIFontMetrics(forTextStyle: .largeTitle)
            .scaledFont(for: .monospacedSystemFont(ofSize: 40, weight: .semibold))
        codeLabel.adjustsFontForContentSizeCategory = true
        codeLabel.textAlignment = .center
        codeLabel.adjustsFontSizeToFitWidth = true
        codeLabel.accessibilityIdentifier = "pairing.userCode"

        qrView.contentMode = .scaleAspectFit
        qrView.setContentHuggingPriority(.defaultLow, for: .vertical)

        statusLabel.numberOfLines = 0
        statusLabel.textAlignment = .center
        statusLabel.font = .preferredFont(forTextStyle: .footnote)
        statusLabel.textColor = .secondaryLabel
        statusLabel.accessibilityIdentifier = "pairing.status"

        openButton.addTarget(self, action: #selector(openVerification), for: .touchUpInside)
        openButton.isHidden = true

        copyButton.setTitle("Copy code", for: .normal)
        copyButton.addTarget(self, action: #selector(copyCode), for: .touchUpInside)
        copyButton.isHidden = true

        retryButton.setTitle("Request a new code", for: .normal)
        retryButton.addTarget(self, action: #selector(retry), for: .touchUpInside)
        retryButton.isHidden = true
        retryButton.accessibilityIdentifier = "pairing.retry"

        let stack = UIStackView(arrangedSubviews: [
            stepLabel, codeLabel, copyButton, openButton, statusLabel, qrView, retryButton, spinner,
        ])
        stack.axis = .vertical
        stack.spacing = Spacing.loose
        stack.alignment = .center
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)

        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(
                equalTo: view.safeAreaLayoutGuide.topAnchor,
                constant: Spacing.loose
            ),
            stack.leadingAnchor.constraint(
                equalTo: view.safeAreaLayoutGuide.leadingAnchor,
                constant: Spacing.loose
            ),
            stack.trailingAnchor.constraint(
                equalTo: view.safeAreaLayoutGuide.trailingAnchor,
                constant: -Spacing.loose
            ),
            qrView.widthAnchor.constraint(equalToConstant: 200),
            qrView.heightAnchor.constraint(equalToConstant: 200),
            openButton.widthAnchor.constraint(greaterThanOrEqualToConstant: 220),
            stack.bottomAnchor.constraint(
                lessThanOrEqualTo: view.safeAreaLayoutGuide.bottomAnchor,
                constant: -Spacing.loose
            ),
        ])

        beginPairing()
    }

    private func beginPairing() {
        retryButton.isHidden = true
        statusLabel.text = "Requesting a code…"
        statusLabel.textColor = .secondaryLabel
        spinner.startAnimating()
        pollTask?.cancel()
        pollTask = Task { @MainActor in
            do {
                let session = try await pairing.requestSession()
                self.session = session
                present(session)
                try await pairing.waitForApproval(session)
                spinner.stopAnimating()
                statusLabel.text = "Paired."
                onPaired()
            } catch is CancellationError {
                return
            } catch {
                spinner.stopAnimating()
                statusLabel.text = Self.describe(error)
                statusLabel.textColor = .systemRed
                retryButton.isHidden = false
                UIAccessibility.post(notification: .announcement, argument: statusLabel.text)
            }
        }
    }

    private func present(_ session: PairingSession) {
        codeLabel.text = session.userCode
        qrView.image = QRCode.image(for: session.verificationURL.absoluteString, size: 440)
        openButton.isHidden = false
        copyButton.isHidden = false
        statusLabel.text = """
        Open \(session.verificationURL.host() ?? "the approval page") in a browser, \
        sign in, and approve this code. The QR code opens the same page on another device.
        """
    }

    @objc private func retry() {
        beginPairing()
    }

    @objc private func openVerification() {
        guard let url = session?.verificationURL else { return }
        UIApplication.shared.open(url)
    }

    @objc private func copyCode() {
        guard let code = session?.userCode else { return }
        UIPasteboard.general.string = code
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        copyButton.setTitle("Copied", for: .normal)
        Task { @MainActor in
            try? await Task.sleep(for: .seconds(1.5))
            copyButton.setTitle("Copy code", for: .normal)
        }
    }

    private static func describe(_ error: any Error) -> String {
        guard let pairingError = error as? PairingError else {
            return error.localizedDescription
        }
        return switch pairingError {
        case .denied: "The request was denied on the server."
        case .expired: "The code expired. Go back and try again."
        case .rejectedClient: "This server does not accept the Space client."
        case .malformedResponse: "The server sent a response Space could not read."
        case let .server(message): message
        }
    }
}
