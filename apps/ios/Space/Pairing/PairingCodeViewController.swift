import SpaceCore
import SpaceUI
import UIKit

final class PairingCodeViewController: UIViewController {
    private let scrollView = UIScrollView()
    private let contentStack = UIStackView()
    private let headingLabel = UILabel()
    private let descriptionLabel = UILabel()
    private let codeLabel = UILabel()
    private let qrView = UIImageView()
    private let qrContainer = UIView()
    private let statusLabel = UILabel()
    private let copyButton = UIButton(type: .system)
    private let openButton = PrimaryGlassButton(title: "Open approval page")
    private let retryButton = UIButton(type: .system)
    private let spinner = UIActivityIndicatorView(style: .medium)
    private let successView = UIStackView()

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
        view.backgroundColor = SpacePalette.page
        navigationItem.largeTitleDisplayMode = .never

        configureContent()
        configureSuccessView()
        beginPairing()
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        if isMovingFromParent || navigationController?.isBeingDismissed == true {
            pollTask?.cancel()
        }
    }

    private func configureContent() {
        headingLabel.text = "Approve this device"
        headingLabel.font = .preferredFont(forTextStyle: .title1)
        headingLabel.adjustsFontForContentSizeCategory = true
        headingLabel.textColor = SpacePalette.primary

        let host = endpoint.baseURL.host() ?? "your site"
        descriptionLabel.text = "Open the approval page for \(host), sign in, and approve the code shown here."
        descriptionLabel.font = .preferredFont(forTextStyle: .body)
        descriptionLabel.adjustsFontForContentSizeCategory = true
        descriptionLabel.textColor = SpacePalette.muted
        descriptionLabel.numberOfLines = 0

        codeLabel.font = UIFontMetrics(forTextStyle: .largeTitle).scaledFont(
            for: .monospacedSystemFont(ofSize: 32, weight: .semibold)
        )
        codeLabel.adjustsFontForContentSizeCategory = true
        codeLabel.textColor = SpacePalette.primary
        codeLabel.adjustsFontSizeToFitWidth = true
        codeLabel.minimumScaleFactor = 0.72
        codeLabel.accessibilityIdentifier = "pairing.userCode"

        var copyConfiguration = UIButton.Configuration.glass()
        copyConfiguration.title = "Copy"
        copyConfiguration.image = UIImage(systemName: "doc.on.doc")
        copyConfiguration.imagePadding = Spacing.small
        copyConfiguration.cornerStyle = .capsule
        copyButton.configuration = copyConfiguration
        copyButton.addTarget(self, action: #selector(copyCode), for: .touchUpInside)
        copyButton.isHidden = true

        let codeRow = UIStackView(arrangedSubviews: [codeLabel, copyButton])
        codeRow.axis = .horizontal
        codeRow.alignment = .center
        codeRow.spacing = Spacing.small
        codeRow.layoutMargins = UIEdgeInsets(
            top: Spacing.medium,
            left: Spacing.regular,
            bottom: Spacing.medium,
            right: Spacing.small
        )
        codeRow.isLayoutMarginsRelativeArrangement = true
        codeRow.backgroundColor = SpacePalette.inset
        codeRow.layer.cornerRadius = Radius.control
        codeRow.layer.cornerCurve = .continuous
        codeRow.layer.borderWidth = 0.5
        codeRow.layer.borderColor = UIColor.separator.cgColor

        var openConfiguration = openButton.configuration ?? .prominentGlass()
        openConfiguration.image = UIImage(systemName: "safari")
        openConfiguration.imagePadding = Spacing.small
        openButton.configuration = openConfiguration
        openButton.addTarget(self, action: #selector(openVerification), for: .touchUpInside)
        openButton.isHidden = true
        openButton.accessibilityIdentifier = "pairing.openApproval"

        statusLabel.numberOfLines = 0
        statusLabel.font = .preferredFont(forTextStyle: .footnote)
        statusLabel.adjustsFontForContentSizeCategory = true
        statusLabel.textColor = SpacePalette.muted
        statusLabel.accessibilityIdentifier = "pairing.status"

        let statusRow = UIStackView(arrangedSubviews: [spinner, statusLabel])
        statusRow.axis = .horizontal
        statusRow.alignment = .center
        statusRow.spacing = Spacing.small
        statusRow.heightAnchor.constraint(greaterThanOrEqualToConstant: 44).isActive = true

        var retryConfiguration = UIButton.Configuration.glass()
        retryConfiguration.title = "Request a new code"
        retryConfiguration.cornerStyle = .capsule
        retryButton.configuration = retryConfiguration
        retryButton.addTarget(self, action: #selector(retry), for: .touchUpInside)
        retryButton.isHidden = true
        retryButton.accessibilityIdentifier = "pairing.retry"

        let separator = UIView()
        separator.backgroundColor = .separator
        separator.heightAnchor.constraint(equalToConstant: 1 / UIScreen.main.scale).isActive = true

        let otherDeviceLabel = UILabel()
        otherDeviceLabel.text = "Approve on another device"
        otherDeviceLabel.font = .preferredFont(forTextStyle: .headline)
        otherDeviceLabel.adjustsFontForContentSizeCategory = true
        otherDeviceLabel.textColor = SpacePalette.primary

        let qrHint = UILabel()
        qrHint.text = "Scan this QR code from a signed-in device. It opens the same approval page."
        qrHint.font = .preferredFont(forTextStyle: .footnote)
        qrHint.adjustsFontForContentSizeCategory = true
        qrHint.textColor = SpacePalette.muted
        qrHint.numberOfLines = 0

        qrView.contentMode = .scaleAspectFit
        qrView.backgroundColor = .white
        qrView.layer.cornerRadius = Radius.control
        qrView.layer.cornerCurve = .continuous
        qrView.clipsToBounds = true
        qrView.isHidden = true

        qrContainer.addSubview(qrView)
        qrView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            qrView.topAnchor.constraint(equalTo: qrContainer.topAnchor),
            qrView.bottomAnchor.constraint(equalTo: qrContainer.bottomAnchor),
            qrView.centerXAnchor.constraint(equalTo: qrContainer.centerXAnchor),
            qrView.widthAnchor.constraint(equalToConstant: 196),
            qrView.heightAnchor.constraint(equalToConstant: 196),
        ])

        contentStack.axis = .vertical
        contentStack.alignment = .fill
        contentStack.spacing = Spacing.medium
        contentStack.setCustomSpacing(Spacing.large, after: descriptionLabel)
        contentStack.setCustomSpacing(Spacing.large, after: statusRow)
        contentStack.setCustomSpacing(Spacing.large, after: separator)
        [
            headingLabel,
            descriptionLabel,
            codeRow,
            openButton,
            statusRow,
            retryButton,
            separator,
            otherDeviceLabel,
            qrHint,
            qrContainer,
        ].forEach { contentStack.addArrangedSubview($0) }

        scrollView.alwaysBounceVertical = true
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        contentStack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(scrollView)
        scrollView.addSubview(contentStack)

        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            contentStack.topAnchor.constraint(
                equalTo: scrollView.contentLayoutGuide.topAnchor,
                constant: Spacing.large
            ),
            contentStack.bottomAnchor.constraint(
                equalTo: scrollView.contentLayoutGuide.bottomAnchor,
                constant: -Spacing.section
            ),
            contentStack.leadingAnchor.constraint(
                equalTo: scrollView.contentLayoutGuide.leadingAnchor,
                constant: Spacing.large
            ),
            contentStack.trailingAnchor.constraint(
                equalTo: scrollView.contentLayoutGuide.trailingAnchor,
                constant: -Spacing.large
            ),
            contentStack.widthAnchor.constraint(
                equalTo: scrollView.frameLayoutGuide.widthAnchor,
                constant: -Spacing.large * 2
            ),
            openButton.heightAnchor.constraint(
                greaterThanOrEqualToConstant: PrimaryGlassButton.minimumHeight
            ),
        ])
    }

    private func configureSuccessView() {
        let icon = UIImageView(image: UIImage(systemName: "checkmark.circle.fill"))
        icon.tintColor = SpacePalette.success
        icon.contentMode = .scaleAspectFit
        icon.preferredSymbolConfiguration = UIImage.SymbolConfiguration(pointSize: 48)

        let label = UILabel()
        label.text = "Paired"
        label.font = .preferredFont(forTextStyle: .title2)
        label.adjustsFontForContentSizeCategory = true
        label.textColor = SpacePalette.primary
        label.textAlignment = .center

        successView.axis = .vertical
        successView.alignment = .center
        successView.spacing = Spacing.medium
        successView.addArrangedSubview(icon)
        successView.addArrangedSubview(label)
        successView.isHidden = true
        successView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(successView)

        NSLayoutConstraint.activate([
            successView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            successView.centerYAnchor.constraint(equalTo: view.centerYAnchor, constant: -40),
            icon.widthAnchor.constraint(equalToConstant: 64),
            icon.heightAnchor.constraint(equalToConstant: 64),
        ])
    }

    private func beginPairing() {
        retryButton.isHidden = true
        openButton.isHidden = true
        copyButton.isHidden = true
        qrView.isHidden = true
        qrContainer.isHidden = true
        codeLabel.text = "——— ———"
        statusLabel.text = "Requesting a code…"
        statusLabel.textColor = SpacePalette.muted
        spinner.startAnimating()
        pollTask?.cancel()
        pollTask = Task { @MainActor in
            do {
                let session = try await pairing.requestSession()
                self.session = session
                present(session)
                try await pairing.waitForApproval(session)
                showSuccess()
            } catch is CancellationError {
                return
            } catch {
                spinner.stopAnimating()
                statusLabel.text = Self.describe(error)
                statusLabel.textColor = SpacePalette.danger
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
        qrView.isHidden = false
        qrContainer.isHidden = false
        statusLabel.text = "Waiting for approval…"
        statusLabel.textColor = SpacePalette.muted
        spinner.startAnimating()
    }

    private func showSuccess() {
        spinner.stopAnimating()
        UIView.transition(with: view, duration: 0.35, options: .transitionCrossDissolve) {
            self.scrollView.isHidden = true
            self.successView.isHidden = false
        }
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        UIAccessibility.post(notification: .announcement, argument: "Paired")
        Task { @MainActor in
            let verificationDelay = UserDefaults.standard.double(
                forKey: "space.pairingSuccessDelay"
            )
            let delay = verificationDelay > 0
                ? min(verificationDelay, 5)
                : 0.5
            try? await Task.sleep(for: .seconds(delay))
            onPaired()
        }
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
        copyButton.configuration?.title = "Copied"
        Task { @MainActor in
            try? await Task.sleep(for: .seconds(1.5))
            copyButton.configuration?.title = "Copy"
        }
    }

    private static func describe(_ error: any Error) -> String {
        guard let pairingError = error as? PairingError else {
            return error.localizedDescription
        }
        return switch pairingError {
        case .denied: "The request was denied on the server."
        case .expired: "This code expired. Request a new code to continue."
        case .rejectedClient: "This server does not accept the Space client."
        case .malformedResponse: "The server returned an unreadable pairing response."
        case let .server(message): message
        }
    }
}
