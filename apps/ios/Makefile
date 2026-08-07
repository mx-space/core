SIMULATOR ?= iPhone 17 Pro
DESTINATION := platform=iOS Simulator,name=$(SIMULATOR)

# The OpenAPI build-tool plugin has no interactive trust prompt in CI, so every
# xcodebuild invocation must skip plugin validation explicitly.
XCB := xcodebuild -skipPackagePluginValidation -destination "$(DESTINATION)"

.PHONY: project build test contract clean

project:
	xcodegen generate

contract:
	pnpm -C ../core run openapi:check

build: project
	$(XCB) -project Space.xcodeproj -scheme Space build

# SpaceCore is platform-agnostic and runs on the host; SpaceUI needs UIKit, so
# it is driven through its own package scheme on a simulator.
test:
	swift test --package-path Packages/SpaceCore
	cd Packages/SpaceUI && xcodebuild -scheme SpaceUI -destination "$(DESTINATION)" test

# End-to-end run against a live instance. The approver stands in for the
# operator's browser approval; `TEST_RUNNER_` is the only way an env var
# reaches the UI-test process.
verify: project
	$(XCB) -project Space.xcodeproj -scheme Space build-for-testing
	SPACE_SERVER=$(SPACE_SERVER) SPACE_USERNAME=$(SPACE_USERNAME) \
	  SPACE_PASSWORD=$(SPACE_PASSWORD) PG_DATABASE=$(PG_DATABASE) \
	  ./scripts/approve-device.sh & \
	  approver=$$!; \
	  $(XCB) -project Space.xcodeproj -scheme Space \
	    TEST_RUNNER_SPACE_TEST_SERVER=$(SPACE_SERVER) test-without-building; \
	  status=$$?; wait $$approver || true; exit $$status

clean:
	rm -rf Space.xcodeproj Packages/*/.build
