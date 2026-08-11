import XCTest

/// Drives the whole first-run path against a live mx-core instance. The
/// operator's browser approval is performed out-of-band by
/// `scripts/approve-device.sh`, which polls the instance and approves the
/// newest pending code — the app's real polling loop is what is under test.
///
/// Set `SPACE_TEST_SERVER` to the instance address; the test is skipped when
/// it is absent so the suite stays green on machines without a server.
@MainActor
final class PairingFlowUITests: XCTestCase {
    private var serverAddress: String? {
        ProcessInfo.processInfo.environment["SPACE_TEST_SERVER"]
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .flatMap { $0.isEmpty ? nil : $0 }
    }

    func testPairsAndLandsOnDashboard() throws {
        let server = try XCTUnwrap(
            serverAddress,
            "SPACE_TEST_SERVER is unset — run `make verify` instead of a bare test."
        )

        let app = XCUIApplication()
        app.launchArguments += [
            "-space.resetPairing", "YES",
            "-space.pairingSuccessDelay", "2",
        ]
        app.launch()

        let field = app.textFields.firstMatch
        XCTAssertTrue(field.waitForExistence(timeout: 10), "server setup screen never appeared")
        capture(app, name: "01-connect-empty")

        app.buttons["Continue"].tap()
        XCTAssertTrue(
            app.staticTexts["Enter a site address first."].waitForExistence(timeout: 5),
            "empty-address validation never appeared"
        )
        capture(app, name: "02-connect-validation")

        field.tap()
        capture(app, name: "03-connect-keyboard")
        field.typeText(server)
        capture(app, name: "04-connect-filled")
        app.buttons["Continue"].tap()

        let code = app.staticTexts["pairing.userCode"]
        XCTAssertTrue(code.waitForExistence(timeout: 20), "no pairing code was issued")
        XCTAssertEqual(code.label.count, 8, "expected an eight character user code")
        capture(app, name: "05-pair-pending")

        XCTAssertTrue(
            app.staticTexts["Paired"].waitForExistence(timeout: 90),
            "pairing success state never appeared"
        )
        capture(app, name: "06-pair-success")

        // The external approver has up to a minute to notice the pending code.
        let dashboard = app.descendants(matching: .any)["dashboard.counters"]
        XCTAssertTrue(
            dashboard.waitForExistence(timeout: 90),
            "pairing never completed — dashboard counters never rendered"
        )

        XCTAssertTrue(app.staticTexts["At a glance"].exists)

        capture(app, name: "07-today")

        try assertMovementSurface(app)
        try assertSiteSurfaces(app)
        try assertCommentsSurface(app)

        try assertRecentlySurface(app)
        try assertWebHandoff(app)
    }

    private func assertMovementSurface(_ app: XCUIApplication) throws {
        app.descendants(matching: .any)["dashboard.counters"].tap()

        XCTAssertTrue(
            app.otherElements["movement.chart"].waitForExistence(timeout: 20),
            "movement chart never rendered"
        )
        XCTAssertTrue(app.staticTexts["Top content"].exists)
        capture(app, name: "08-movement-today")

        app.buttons["7D"].tap()
        settle()
        capture(app, name: "09-movement-7d")

        app.buttons["30D"].tap()
        settle()
        capture(app, name: "10-movement-30d")
        app.navigationBars.buttons.firstMatch.tap()
    }

    private func assertCommentsSurface(_ app: XCUIApplication) throws {
        app.buttons["tab.inbox"].tap()

        let list = app.collectionViews["comments.list"]
        XCTAssertTrue(
            list.waitForExistence(timeout: 20),
            "comments list never rendered"
        )
        try selectCommentFilter("unread", captureName: "16-inbox-unread", app: app, list: list)
        try selectCommentFilter("all", captureName: "17-inbox-all", app: app, list: list)
        try selectCommentFilter("awaiting", captureName: "18-inbox-awaiting", app: app, list: list)
        try selectCommentFilter("whispers", captureName: "19-inbox-whispers", app: app, list: list)
        try selectCommentFilter("read", captureName: "20-inbox-read", app: app, list: list)
        try selectCommentFilter("junk", captureName: "21-inbox-junk", app: app, list: list)

        let junkComment = list.cells["comments.row"].firstMatch
        junkComment.tap()
        XCTAssertTrue(
            app.buttons["Restore and reply"].waitForExistence(timeout: 20),
            "junk detail did not render its restore action"
        )
        capture(app, name: "22-comment-detail-junk")
        app.buttons["Comment actions"].tap()
        capture(app, name: "23-comment-junk-actions")
        app.buttons["Restore"].tap()
        XCTAssertTrue(
            app.textFields["comments.reply"].waitForExistence(timeout: 15),
            "restoring junk did not reveal the reply composer"
        )
        capture(app, name: "24-comment-restored")
        app.navigationBars.buttons.firstMatch.tap()

        try selectCommentFilter("awaiting", captureName: nil, app: app, list: list)
        let firstComment = list.cells["comments.row"].firstMatch
        firstComment.tap()
        XCTAssertTrue(
            app.textFields["comments.reply"].waitForExistence(timeout: 20),
            "comment detail and reply composer never rendered"
        )
        capture(app, name: "25-comment-detail")

        let details = app.buttons["Details"]
        if details.exists {
            details.tap()
            capture(app, name: "26-comment-details-expanded")
        }

        app.buttons["Comment actions"].tap()
        capture(app, name: "27-comment-actions")
        if app.buttons["Mark as Unread"].exists {
            app.buttons["Mark as Unread"].tap()
        } else if app.buttons["Mark as Read"].exists {
            app.buttons["Mark as Read"].tap()
        }

        let reply = app.textFields["comments.reply"]
        reply.tap()
        reply.typeText("Verified locally from Space iOS.")
        capture(app, name: "28-comment-reply-keyboard")
        app.buttons["comments.send"].tap()
        XCTAssertTrue(
            waitUntil(timeout: 20) {
                (reply.value as? String) == "Reply as owner"
            },
            "owner reply was not submitted"
        )
        capture(app, name: "29-comment-replied")
        app.navigationBars.buttons.firstMatch.tap()
    }

    /// Composes an entry with a mid-sentence link, confirms the keyboard-bound
    /// composer resolves it as a selected enrichment, and proves the server
    /// returns the published row with the card in its original content order.
    private func assertRecentlySurface(_ app: XCUIApplication) throws {
        app.buttons["tab.content"].tap()

        let list = app.collectionViews["recently.list"]
        XCTAssertTrue(list.waitForExistence(timeout: 15), "recently list never appeared")
        XCTAssertTrue(
            list.cells.firstMatch.waitForExistence(timeout: 15),
            "seeded recently feed never appeared"
        )
        capture(app, name: "30-content-feed")

        let editor = app.descendants(matching: .any)["recently.composer.text"]
        XCTAssertTrue(editor.waitForExistence(timeout: 10), "inline composer never appeared")
        editor.tap()
        editor.typeText("x")
        editor.typeText(XCUIKeyboardKey.delete.rawValue)
        XCTAssertTrue(
            waitUntil(timeout: 5) { app.keyboards.firstMatch.isHittable },
            "inline composer keyboard never appeared"
        )
        settle(0.5)
        capture(app, name: "31-composer-keyboard-empty")

        editor.typeText("/")
        XCTAssertTrue(
            app.descendants(matching: .any)["recently.composer.slash.menu"]
                .waitForExistence(timeout: 5),
            "slash menu did not open"
        )
        XCTAssertTrue(app.buttons["recently.composer.slash.tmdb"].exists)
        XCTAssertTrue(app.buttons["recently.composer.slash.context"].exists)
        capture(app, name: "31a-composer-slash-menu")

        editor.typeText("tm")
        XCTAssertTrue(
            app.buttons["recently.composer.slash.tmdb"].waitForExistence(timeout: 5),
            "slash menu did not filter to TMDB"
        )
        XCTAssertFalse(app.buttons["recently.composer.slash.context"].exists)
        let tmdbCommand = app.buttons["recently.composer.slash.tmdb"]
        XCTAssertTrue(tmdbCommand.isHittable, "the visible TMDB command was not tappable")
        tmdbCommand.tap()

        let tmdbSearch = app.textFields["recently.composer.attachment.search"]
        XCTAssertTrue(
            tmdbSearch.waitForExistence(timeout: 5),
            "the TMDB command did not open attachment search"
        )
        XCTAssertTrue(
            app.descendants(matching: .any)["recently.composer.command.detail"].exists,
            "the command detail panel did not appear"
        )
        XCTAssertTrue(
            app.keyboards.firstMatch.waitForExistence(timeout: 5),
            "command search did not retain the keyboard"
        )
        capture(app, name: "31b-composer-slash-tmdb")

        app.buttons["recently.composer.command.back"].tap()
        XCTAssertTrue(
            app.descendants(matching: .any)["recently.composer.slash.menu"]
                .waitForExistence(timeout: 5),
            "command detail did not return to the slash menu"
        )
        app.buttons["recently.composer.slash.tmdb"].tap()
        XCTAssertTrue(tmdbSearch.waitForExistence(timeout: 5))
        app.buttons["recently.composer.command.close"].tap()

        let message =
            "Local verification confirms that the keyboard-bound composer grows naturally "
            + "while metadata remains visible above the input. "
            + "Reference: https://bgm.tv/subject/265"
        editor.typeText(message)
        capture(app, name: "32-composer-auto-size")

        app.buttons["recently.composer.context"].tap()
        let contextSearch = app.textFields["recently.composer.attachment.search"]
        XCTAssertTrue(
            contextSearch.waitForExistence(timeout: 15),
            "context picker never appeared"
        )
        capture(app, name: "33-composer-context-picker")

        contextSearch.tap()
        contextSearch.typeText("Keyboard")
        let context = app.buttons[
            "recently.composer.context.candidate.note.900000000000000005"
        ]
        XCTAssertTrue(context.waitForExistence(timeout: 15), "seeded note context is missing")
        context.tap()
        XCTAssertTrue(
            app.descendants(matching: .any)["recently.composer.selection.context"]
                .waitForExistence(timeout: 10),
            "selected context receipt never appeared"
        )
        capture(app, name: "34-composer-context-selected")

        XCTAssertTrue(
            app.descendants(matching: .any)["recently.composer.enrichment"]
                .firstMatch
                .waitForExistence(timeout: 25),
            "composer never previewed the enrichment for an inline link"
        )

        capture(app, name: "35-composer-link-selected")

        let initialCount = list.cells.count
        app.buttons["recently.composer.post"].tap()

        XCTAssertTrue(
            waitUntil(timeout: 10) { !app.keyboards.firstMatch.exists },
            "the keyboard remained visible after publishing"
        )
        XCTAssertTrue(
            waitUntil(timeout: 30) {
                list.cells.count > initialCount
            },
            "the new entry never appeared in the list"
        )

        // The collection uses lazy cells. Return to the newest row before
        // asking for the media card's accessibility node.
        list.swipeDown()
        settle()
        let createdRow = list.cells.firstMatch
        let createdID = createdRow.identifier.replacingOccurrences(
            of: "recently.row.",
            with: ""
        )
        XCTAssertTrue(
            app.descendants(matching: .any)["recently.enrichment.\(createdID)"]
                .firstMatch
                .waitForExistence(timeout: 25),
            "the posted entry rendered without its media card"
        )
        XCTAssertTrue(
            createdRow.descendants(matching: .any)["Note context, Keyboard composer field notes"]
                .firstMatch
                .waitForExistence(timeout: 10),
            "the posted entry rendered without its selected context"
        )
        capture(app, name: "36-content-created")

        let actions = createdRow.buttons["recently.actions"].firstMatch
        XCTAssertTrue(actions.waitForExistence(timeout: 10), "recently actions menu is missing")
        actions.tap()
        capture(app, name: "37-content-actions")
        performSkippingQuiescence(app) {
            app.buttons["Edit"].tap()
        }
        XCTAssertTrue(app.staticTexts["Editing"].waitForExistence(timeout: 10))
        capture(app, name: "38-composer-editing")

        editor.coordinate(withNormalizedOffset: CGVector(dx: 0.92, dy: 0.88)).tap()
        editor.typeText(" Updated after local review.")
        app.buttons["recently.composer.post"].tap()
        XCTAssertTrue(
            waitUntil(timeout: 10) { !app.keyboards.firstMatch.exists },
            "the keyboard remained visible after saving"
        )
        XCTAssertTrue(
            app.staticTexts["Edited"].waitForExistence(timeout: 25),
            "edited entry never returned to the feed"
        )
        XCTAssertTrue(
            createdRow.descendants(matching: .any)["Note context, Keyboard composer field notes"]
                .firstMatch
                .waitForExistence(timeout: 10),
            "editing the entry cleared its selected context"
        )
        settle()
        capture(app, name: "39-content-edited")

        actions.tap()
        performSkippingQuiescence(app) {
            app.buttons["Delete"].tap()
        }
        XCTAssertTrue(
            app.alerts["Delete this Recently entry?"].waitForExistence(timeout: 10),
            "delete confirmation did not appear"
        )
        capture(app, name: "40-content-delete-confirmation")
        app.alerts.buttons["Cancel"].tap()
    }

    private func assertSiteSurfaces(_ app: XCUIApplication) throws {
        app.buttons["tab.today"].tap()

        let siteMenu = app.buttons["Site menu"]
        XCTAssertTrue(siteMenu.waitForExistence(timeout: 10), "Site menu is missing")
        siteMenu.tap()
        capture(app, name: "11-site-menu")

        app.buttons["Site Settings"].tap()
        XCTAssertTrue(
            app.navigationBars["Site Settings"].waitForExistence(timeout: 10),
            "site settings did not open"
        )
        capture(app, name: "12-site-settings")

        app.buttons["Unpair from this site"].tap()
        XCTAssertTrue(app.alerts["Unpair from this site?"].waitForExistence(timeout: 10))
        capture(app, name: "13-unpair-confirmation")
        app.alerts.buttons["Cancel"].tap()
        app.navigationBars.buttons.firstMatch.tap()
        capture(app, name: "14-today-after-settings")
    }

    private func assertWebHandoff(_ app: XCUIApplication) throws {
        let siteMenu = app.buttons["Site menu"]
        XCTAssertTrue(siteMenu.waitForExistence(timeout: 10), "Site menu is missing")
        siteMenu.tap()
        let webAdmin = app.buttons["Open Web Admin"]
        XCTAssertTrue(webAdmin.waitForExistence(timeout: 10), "Web Admin menu action is missing")
        webAdmin.tap()

        XCTAssertTrue(
            app.webViews.firstMatch.waitForExistence(timeout: 30),
            "authenticated Web handoff did not open the admin page"
        )
        settle(2)
        XCTAssertFalse(
            app.buttons["登录"].exists,
            "Web handoff reached the login screen instead of an authenticated session"
        )
        capture(app, name: "41-web-handoff")
        let close = app.buttons["Close"]
        XCTAssertTrue(
            close.waitForExistence(timeout: 10),
            "Safari handoff controller did not expose its close control"
        )
    }

    private func selectCommentFilter(
        _ filter: String,
        captureName: String?,
        app: XCUIApplication,
        list: XCUIElement
    ) throws {
        let button = app.buttons["comments.filter.\(filter)"]
        XCTAssertTrue(button.waitForExistence(timeout: 10), "\(filter) filter is missing")
        button.tap()
        XCTAssertTrue(
            list.cells["comments.row"].firstMatch.waitForExistence(timeout: 20),
            "\(filter) filter did not render its seeded rows"
        )
        settle()
        if let captureName { capture(app, name: captureName) }
    }

    @discardableResult
    private func waitUntil(
        timeout: TimeInterval,
        pollInterval: TimeInterval = 0.2,
        predicate: () -> Bool
    ) -> Bool {
        let deadline = Date().addingTimeInterval(timeout)
        repeat {
            if predicate() { return true }
            RunLoop.current.run(until: Date().addingTimeInterval(pollInterval))
        } while Date() < deadline
        return predicate()
    }

    private func settle(_ seconds: TimeInterval = 0.8) {
        RunLoop.current.run(until: Date().addingTimeInterval(seconds))
    }

    /// iOS 26's Liquid Glass menu can keep reporting an active system
    /// animation after it is visually settled. The UI remains interactive, so
    /// menu-item taps skip XCTest's pre/post-event animation-idle gate only.
    private func performSkippingQuiescence(
        _ app: XCUIApplication,
        operation: @escaping () -> Void
    ) {
        let selector = NSSelectorFromString("_performWithInteractionOptions:block:")
        guard app.responds(to: selector) else {
            operation()
            return
        }

        typealias Operation = @convention(block) () -> Void
        typealias Invocation = @convention(c) (
            AnyObject,
            Selector,
            UInt,
            Operation
        ) -> Void

        let invocation = unsafeBitCast(app.method(for: selector), to: Invocation.self)
        let block: Operation = operation
        invocation(app, selector, 3, block)
    }

    private func capture(_ app: XCUIApplication, name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
