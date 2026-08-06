import Foundation
import Testing

@testable import SpaceCore

@Suite struct DateTranscoderTests {
    private let transcoder = MillisecondTolerantDateTranscoder()

    /// `Date.prototype.toISOString()` always emits milliseconds, so this is the
    /// shape every mx-core timestamp actually arrives in.
    @Test func decodesTheMillisecondFormMxCoreEmits() throws {
        let date = try transcoder.decode("2026-08-04T18:27:30.809Z")
        #expect(abs(date.timeIntervalSince1970 - 1_785_868_050.809) < 0.001)
    }

    @Test func stillDecodesWholeSeconds() throws {
        let date = try transcoder.decode("2026-08-04T18:27:30Z")
        #expect(date.timeIntervalSince1970 == 1_785_868_050)
    }

    @Test func roundTrips() throws {
        let original = Date(timeIntervalSince1970: 1_785_868_050.809)
        let decoded = try transcoder.decode(try transcoder.encode(original))
        #expect(abs(decoded.timeIntervalSince1970 - original.timeIntervalSince1970) < 0.001)
    }

    @Test func rejectsNonISOInput() {
        #expect(throws: (any Error).self) { try transcoder.decode("yesterday") }
    }
}
