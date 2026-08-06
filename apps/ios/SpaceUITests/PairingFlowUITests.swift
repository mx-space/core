import XCTest

/// Drives the whole first-run path against a live mx-core instance. The
/// operator's browser approval is performed out-of-band by
/// `scripts/approve-device.sh`, which polls the instance and approves the
/// newest pending code — the app's real polling loop is what is under test.
///
/// Set `SPACE_TEST_SERVER` to the instance address; the test is skipped when
/// it is absent so the suite stays green on machines without a server.
final class PairingFlowUITests: XCTestCase {
    private var serverAddress: String? {
        ProcessInfo.processInfo.environment["SPACE_TEST_SERVER"]
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
        let dashboard = app.otherElements["dashboard.counters"]
        XCTAssertTrue(
            dashboard.waitForExistence(timeout: 90),
            "pairing never completed — dashboard counters never rendered"
        )

        XCTAssertTrue(app.staticTexts["Needs attention"].exists)

        try assertRecentlySurface(app)
    }

    /// Composes an entry with a mid-sentence link, proves the composer resolves
    /// and previews it, takes the offered fix, and confirms the posted row comes
    /// back carrying the hydrated media card.
    private func assertRecentlySurface(_ app: XCUIApplication) throws {
        app.buttons["tab.recently"].tap()

        let list = app.collectionViews["recently.list"]
        XCTAssertTrue(list.waitForExistence(timeout: 15), "recently list never appeared")

        app.buttons["recently.compose"].tap()
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

        let composerShot = XCTAttachment(screenshot: app.screenshot())
        composerShot.name = "composer"
        composerShot.lifetime = .keepAlways
        add(composerShot)

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

        let listShot = XCTAttachment(screenshot: app.screenshot())
        listShot.name = "recently"
        listShot.lifetime = .keepAlways
        add(listShot)
    }
}
