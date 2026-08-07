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
        app.launchArguments += ["-space.resetPairing", "YES"]
        app.launch()

        let field = app.textFields.firstMatch
        XCTAssertTrue(field.waitForExistence(timeout: 10), "server setup screen never appeared")
        field.tap()
        field.typeText(server)
        app.buttons["Continue"].tap()

        let code = app.staticTexts["pairing.userCode"]
        XCTAssertTrue(code.waitForExistence(timeout: 20), "no pairing code was issued")
        XCTAssertEqual(code.label.count, 8, "expected an eight character user code")

        // The external approver has up to a minute to notice the pending code.
        let dashboard = app.descendants(matching: .any)["dashboard.counters"]
        XCTAssertTrue(
            dashboard.waitForExistence(timeout: 90),
            "pairing never completed — dashboard counters never rendered"
        )

        XCTAssertTrue(app.staticTexts["Needs attention"].exists)

        capture(app, name: "dashboard")

        try assertMovementSurface(app)
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
        capture(app, name: "movement")
        app.navigationBars.buttons.firstMatch.tap()
    }

    private func assertCommentsSurface(_ app: XCUIApplication) throws {
        app.buttons["tab.inbox"].tap()

        let list = app.collectionViews["comments.list"]
        XCTAssertTrue(
            list.waitForExistence(timeout: 20),
            "comments list never rendered"
        )
        let all = app.buttons["comments.filter.all"]
        XCTAssertTrue(all.exists, "All comments filter is missing")
        all.tap()
        let firstComment = list.cells["comments.row"].firstMatch
        XCTAssertTrue(
            firstComment.waitForExistence(timeout: 20),
            "All comments filter did not render its rows"
        )
        capture(app, name: "comments")

        firstComment.tap()
        XCTAssertTrue(
            app.textFields["comments.reply"].waitForExistence(timeout: 20),
            "comment detail and reply composer never rendered"
        )
        capture(app, name: "comment-detail")
        app.navigationBars.buttons.firstMatch.tap()
    }

    /// Composes an entry with a mid-sentence link, proves the composer resolves
    /// and previews it, takes the offered fix, and confirms the posted row comes
    /// back carrying the hydrated media card.
    private func assertRecentlySurface(_ app: XCUIApplication) throws {
        app.buttons["tab.content"].tap()

        let list = app.collectionViews["recently.list"]
        XCTAssertTrue(list.waitForExistence(timeout: 15), "recently list never appeared")

        app.buttons["global.compose"].tap()
        let editor = app.textViews["recently.composer.text"]
        XCTAssertTrue(editor.waitForExistence(timeout: 10), "composer never opened")
        editor.tap()
        // Mid-sentence, the shape an author actually types.
        editor.typeText("rewatching https://bgm.tv/subject/265 tonight")

        XCTAssertTrue(
            app.descendants(matching: .any)["recently.enrichment"]
                .firstMatch
                .waitForExistence(timeout: 25),
            "composer never previewed the enrichment for an inline link"
        )

        capture(app, name: "composer")

        // The link cannot be cardified where it sits, so the fix must be offered.
        let fix = app.buttons["recently.composer.isolateLink"]
        XCTAssertTrue(fix.exists, "no one-tap fix offered for a mid-sentence link")
        fix.tap()
        XCTAssertFalse(fix.exists, "the hint should clear once the link owns its line")

        app.buttons["recently.composer.post"].tap()

        XCTAssertTrue(
            app.staticTexts["rewatching"].waitForExistence(timeout: 25),
            "the new entry never appeared in the list"
        )
        XCTAssertTrue(
            app.descendants(matching: .any)["recently.enrichment"]
                .firstMatch
                .waitForExistence(timeout: 25),
            "the posted entry rendered without its media card"
        )

        capture(app, name: "recently")
    }

    private func assertWebHandoff(_ app: XCUIApplication) throws {
        app.buttons["tab.today"].tap()

        let dashboard = app.scrollViews["dashboard.scroll"]
        let webAdmin = app.buttons["dashboard.web.admin"]
        for _ in 0..<3 where !webAdmin.isHittable {
            dashboard.swipeUp()
        }
        XCTAssertTrue(webAdmin.waitForExistence(timeout: 10), "Web Admin entry is missing")
        webAdmin.tap()

        XCTAssertTrue(
            app.webViews.firstMatch.waitForExistence(timeout: 30),
            "authenticated Web handoff did not open the admin page"
        )
        capture(app, name: "web-handoff")
        let close = app.buttons["Close"]
        XCTAssertTrue(
            close.waitForExistence(timeout: 10),
            "Safari handoff controller did not expose its close control"
        )
        close.tap()
    }

    private func capture(_ app: XCUIApplication, name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
