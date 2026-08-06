import SpaceCore
import SpaceUI
import UIKit

final class PairingCodeViewController: UIViewController {
    private let codeLabel = UILabel()
    private let qrView = UIImageView()
    private let statusLabel = UILabel()
    private let openButton = UIButton(configuration: .bordered())
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

        codeLabel.font = .monospacedSystemFont(ofSize: 40, weight: .semibold)
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
        statusLabel.text = "Requesting a code…"

        openButton.setTitle("Open approval page", for: .normal)
        openButton.addTarget(self, action: #selector(openVerification), for: .touchUpInside)
        openButton.isHidden = true

        let stack = UIStackView(arrangedSubviews: [
            codeLabel, qrView, openButton, statusLabel, spinner,
        ])
        stack.axis = .vertical
        stack.spacing = Spacing.loose
        stack.alignment = .center
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)

        NSLayoutConstraint.activate([
            stack.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            stack.leadingAnchor.constraint(
                equalTo: view.safeAreaLayoutGuide.leadingAnchor,
                constant: Spacing.loose
            ),
            stack.trailingAnchor.constraint(
                equalTo: view.safeAreaLayoutGuide.trailingAnchor,
                constant: -Spacing.loose
            ),
            qrView.widthAnchor.constraint(equalToConstant: 220),
            qrView.heightAnchor.constraint(equalToConstant: 220),
        ])

        spinner.startAnimating()
        start()
    }

    private func start() {
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
            }
        }
    }

    private func present(_ session: PairingSession) {
        codeLabel.text = session.userCode
        qrView.image = QRCode.image(for: session.verificationURL.absoluteString, size: 440)
        openButton.isHidden = false
        statusLabel.text = """
        Open \(session.verificationURL.host() ?? "the approval page") in a browser, \
        sign in, and approve this code.
        """
    }

    @objc private func openVerification() {
        guard let url = session?.verificationURL else { return }
        UIApplication.shared.open(url)
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
