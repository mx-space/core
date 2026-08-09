import SpaceCore
import SpaceUI
import UIKit

final class ServerSetupViewController: UIViewController {
    private let scrollView = UIScrollView()
    private let markView = UILabel()
    private let headingLabel = UILabel()
    private let descriptionLabel = UILabel()
    private let field = UITextField()
    private let continueButton = PrimaryGlassButton(title: "Continue")
    private let statusLabel = UILabel()

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
        title = nil
        view.backgroundColor = SpacePalette.page
        navigationItem.largeTitleDisplayMode = .never

        markView.text = "S"
        markView.font = .systemFont(ofSize: 18, weight: .semibold)
        markView.textColor = .white
        markView.textAlignment = .center
        markView.backgroundColor = SpacePalette.accent
        markView.layer.cornerRadius = 10
        markView.layer.cornerCurve = .continuous
        markView.clipsToBounds = true
        markView.isAccessibilityElement = false

        headingLabel.text = "Connect to your site"
        headingLabel.font = .preferredFont(forTextStyle: .title1)
        headingLabel.adjustsFontForContentSizeCategory = true
        headingLabel.textColor = SpacePalette.primary

        descriptionLabel.text = "Enter the address of the mx-core instance you manage. Space connects directly to that server."
        descriptionLabel.font = .preferredFont(forTextStyle: .body)
        descriptionLabel.adjustsFontForContentSizeCategory = true
        descriptionLabel.textColor = SpacePalette.muted
        descriptionLabel.numberOfLines = 0

        field.placeholder = "https://your-site.com"
        field.font = .preferredFont(forTextStyle: .body)
        field.adjustsFontForContentSizeCategory = true
        field.backgroundColor = SpacePalette.surface
        field.layer.cornerCurve = .continuous
        field.layer.borderWidth = 0.5
        field.layer.borderColor = UIColor.separator.cgColor
        field.clipsToBounds = true
        field.keyboardType = .URL
        field.autocapitalizationType = .none
        field.autocorrectionType = .no
        field.textContentType = .URL
        field.clearButtonMode = .whileEditing
        field.returnKeyType = .continue
        field.setLeftPadding(Spacing.regular)
        field.addTarget(self, action: #selector(submit), for: .editingDidEndOnExit)
        field.accessibilityLabel = "Site address"

        continueButton.titleLabel?.font = .preferredFont(forTextStyle: .headline)
        continueButton.addTarget(self, action: #selector(submit), for: .touchUpInside)
        continueButton.accessibilityIdentifier = "setup.continue"

        statusLabel.numberOfLines = 0
        statusLabel.font = .preferredFont(forTextStyle: .footnote)
        statusLabel.adjustsFontForContentSizeCategory = true
        statusLabel.textColor = SpacePalette.danger
        statusLabel.isHidden = true
        statusLabel.accessibilityIdentifier = "setup.error"

        let markContainer = UIView()
        markContainer.addSubview(markView)
        markView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            markView.topAnchor.constraint(equalTo: markContainer.topAnchor),
            markView.bottomAnchor.constraint(equalTo: markContainer.bottomAnchor),
            markView.leadingAnchor.constraint(equalTo: markContainer.leadingAnchor),
            markView.widthAnchor.constraint(equalToConstant: 36),
            markView.heightAnchor.constraint(equalToConstant: 36),
        ])

        let securityHint = makeSecurityHint()
        let stack = UIStackView(arrangedSubviews: [
            markContainer,
            headingLabel,
            descriptionLabel,
            field,
            securityHint,
            continueButton,
            statusLabel,
        ])
        stack.axis = .vertical
        stack.alignment = .fill
        stack.spacing = Spacing.medium
        stack.setCustomSpacing(Spacing.large, after: descriptionLabel)
        stack.setCustomSpacing(Spacing.large, after: securityHint)
        stack.translatesAutoresizingMaskIntoConstraints = false

        scrollView.alwaysBounceVertical = true
        scrollView.keyboardDismissMode = .interactive
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(scrollView)
        scrollView.addSubview(stack)

        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.keyboardLayoutGuide.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            stack.topAnchor.constraint(
                equalTo: scrollView.contentLayoutGuide.topAnchor,
                constant: 56
            ),
            stack.bottomAnchor.constraint(
                lessThanOrEqualTo: scrollView.contentLayoutGuide.bottomAnchor,
                constant: -Spacing.section
            ),
            stack.leadingAnchor.constraint(
                equalTo: scrollView.contentLayoutGuide.leadingAnchor,
                constant: Spacing.large
            ),
            stack.trailingAnchor.constraint(
                equalTo: scrollView.contentLayoutGuide.trailingAnchor,
                constant: -Spacing.large
            ),
            stack.widthAnchor.constraint(
                equalTo: scrollView.frameLayoutGuide.widthAnchor,
                constant: -Spacing.large * 2
            ),
            field.heightAnchor.constraint(
                greaterThanOrEqualToConstant: PrimaryGlassButton.minimumHeight
            ),
            continueButton.heightAnchor.constraint(
                greaterThanOrEqualToConstant: PrimaryGlassButton.minimumHeight
            ),
        ])
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        navigationController?.setNavigationBarHidden(true, animated: animated)
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        field.layer.cornerRadius = field.bounds.height / 2
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        navigationController?.setNavigationBarHidden(false, animated: animated)
    }

    @objc private func submit() {
        view.endEditing(true)
        guard let endpoint = parseEndpoint() else { return }

        setBusy(true)
        Task { @MainActor in
            defer { setBusy(false) }
            do {
                guard try await probe.probe(endpoint) else {
                    show("That address responded, but it is not an mx-core instance.")
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
            show("Enter a site address first.")
            return nil
        }
        let normalized = raw.contains("://") ? raw : "https://\(raw)"
        guard let url = URL(string: normalized) else {
            show("Enter a valid site address.")
            return nil
        }
        do {
            return try ServerEndpoint(baseURL: url)
        } catch SpaceTransportError.insecureScheme(let host) {
            show("\(host) is public, so Space requires HTTPS.")
        } catch {
            show("Enter a valid site address.")
        }
        return nil
    }

    private func setBusy(_ busy: Bool) {
        field.isEnabled = !busy
        continueButton.isEnabled = !busy
        continueButton.configuration?.showsActivityIndicator = busy
        continueButton.configuration?.title = busy ? "Connecting…" : "Continue"
        if busy { statusLabel.isHidden = true }
    }

    private func show(_ message: String) {
        statusLabel.text = message
        statusLabel.isHidden = false
        UIAccessibility.post(notification: .announcement, argument: message)
    }

    private func makeSecurityHint() -> UIView {
        let symbol = UIImage.SymbolConfiguration(pointSize: 14, weight: .semibold)
        let image = UIImageView(
            image: UIImage(systemName: "lock.fill", withConfiguration: symbol)
        )
        image.tintColor = SpacePalette.subtle
        image.contentMode = .center
        image.translatesAutoresizingMaskIntoConstraints = false
        image.setContentHuggingPriority(.required, for: .horizontal)
        image.setContentHuggingPriority(.required, for: .vertical)
        image.setContentCompressionResistancePriority(.required, for: .horizontal)
        image.setContentCompressionResistancePriority(.required, for: .vertical)
        NSLayoutConstraint.activate([
            image.widthAnchor.constraint(equalToConstant: 20),
            image.heightAnchor.constraint(equalToConstant: 20),
        ])

        let label = UILabel()
        label.text = "Public sites must use HTTPS. Local network addresses may use HTTP."
        label.font = .preferredFont(forTextStyle: .footnote)
        label.adjustsFontForContentSizeCategory = true
        label.textColor = SpacePalette.subtle
        label.numberOfLines = 0

        let row = UIStackView(arrangedSubviews: [image, label])
        row.axis = .horizontal
        row.alignment = .top
        row.spacing = Spacing.small
        return row
    }
}

private extension UITextField {
    func setLeftPadding(_ amount: CGFloat) {
        let spacer = UIView(frame: CGRect(x: 0, y: 0, width: amount, height: 1))
        leftView = spacer
        leftViewMode = .always
    }
}
