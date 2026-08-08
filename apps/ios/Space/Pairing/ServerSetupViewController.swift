import SpaceCore
import SpaceUI
import UIKit

final class ServerSetupViewController: UIViewController {
    private let scrollView = UIScrollView()
    private let stepLabel = UILabel()
    private let headingLabel = UILabel()
    private let field = UITextField()
    private let continueButton = PrimaryGlassButton(title: "Continue")
    private let statusLabel = UILabel()
    private let spinner = UIActivityIndicatorView(style: .medium)

    private static let hint = "Enter the address of your mx-core instance. Public servers must use HTTPS."

    private let probe = HealthProbe()
    private let onReady: (ServerEndpoint) -> Void

    init(onReady: @escaping (ServerEndpoint) -> Void) {
        self.onReady = onReady
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = "Space"
        view.backgroundColor = .systemBackground
        navigationController?.navigationBar.prefersLargeTitles = true

        stepLabel.text = "STEP 1 OF 2"
        stepLabel.font = .preferredFont(forTextStyle: .caption1)
        stepLabel.textColor = .secondaryLabel

        headingLabel.text = "Connect to your site"
        headingLabel.font = .preferredFont(forTextStyle: .title2)
        headingLabel.adjustsFontForContentSizeCategory = true

        field.placeholder = "https://your-site.com"
        field.borderStyle = .roundedRect
        field.keyboardType = .URL
        field.autocapitalizationType = .none
        field.autocorrectionType = .no
        field.textContentType = .URL
        field.clearButtonMode = .whileEditing
        field.addTarget(self, action: #selector(submit), for: .editingDidEndOnExit)

        continueButton.addTarget(self, action: #selector(submit), for: .touchUpInside)

        statusLabel.numberOfLines = 0
        statusLabel.font = .preferredFont(forTextStyle: .footnote)
        statusLabel.adjustsFontForContentSizeCategory = true
        statusLabel.textColor = .secondaryLabel
        statusLabel.text = Self.hint

        let stack = UIStackView(arrangedSubviews: [
            stepLabel,
            headingLabel,
            field,
            continueButton,
            statusLabel,
            spinner,
        ])
        stack.axis = .vertical
        stack.spacing = Spacing.regular
        stack.setCustomSpacing(Spacing.section, after: headingLabel)
        stack.translatesAutoresizingMaskIntoConstraints = false

        scrollView.alwaysBounceVertical = true
        scrollView.keyboardDismissMode = .onDrag
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(scrollView)
        scrollView.addSubview(stack)

        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.keyboardLayoutGuide.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
            stack.topAnchor.constraint(
                equalTo: scrollView.contentLayoutGuide.topAnchor,
                constant: Spacing.loose
            ),
            stack.bottomAnchor.constraint(
                equalTo: scrollView.contentLayoutGuide.bottomAnchor,
                constant: -Spacing.loose
            ),
            stack.leadingAnchor.constraint(
                equalTo: scrollView.contentLayoutGuide.leadingAnchor,
                constant: Spacing.loose
            ),
            stack.trailingAnchor.constraint(
                equalTo: scrollView.contentLayoutGuide.trailingAnchor,
                constant: -Spacing.loose
            ),
            stack.widthAnchor.constraint(
                equalTo: scrollView.frameLayoutGuide.widthAnchor,
                constant: -Spacing.loose * 2
            ),
        ])
    }

    @objc private func submit() {
        view.endEditing(true)
        guard let endpoint = parseEndpoint() else { return }

        setBusy(true)
        Task { @MainActor in
            defer { setBusy(false) }
            do {
                guard try await probe.probe(endpoint) else {
                    show("That address answered, but it is not an mx-core instance.")
                    return
                }
                onReady(endpoint)
            } catch {
                show("Could not reach that address. \(error.localizedDescription)")
            }
        }
    }

    private func parseEndpoint() -> ServerEndpoint? {
        let raw = field.text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !raw.isEmpty else {
            show("Enter a server address first.")
            return nil
        }
        // A bare host is the common case; assume the secure scheme rather than
        // rejecting input that is obviously a URL.
        let normalized = raw.contains("://") ? raw : "https://\(raw)"
        guard let url = URL(string: normalized) else {
            show("That is not a valid address.")
            return nil
        }
        do {
            return try ServerEndpoint(baseURL: url)
        } catch SpaceTransportError.insecureScheme(let host) {
            show("\(host) is a public address, so plain HTTP is refused. Use HTTPS.")
        } catch {
            show("That is not a valid address.")
        }
        return nil
    }

    private func setBusy(_ busy: Bool) {
        continueButton.isEnabled = !busy
        field.isEnabled = !busy
        busy ? spinner.startAnimating() : spinner.stopAnimating()
        if busy {
            statusLabel.text = Self.hint
            statusLabel.textColor = .secondaryLabel
        }
    }

    private func show(_ message: String) {
        statusLabel.text = message
        statusLabel.textColor = .systemRed
        UIAccessibility.post(notification: .announcement, argument: message)
    }
}
