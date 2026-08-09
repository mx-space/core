import Observation

@MainActor
protocol ScrollToTopHandling: AnyObject {
    func scrollToTop()
}

@MainActor
@Observable
final class ScrollToTopSignal {
    private(set) var requestID = 0

    func request() {
        requestID &+= 1
    }
}
