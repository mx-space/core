// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "SpaceUI",
    platforms: [.iOS(.v26)],
    products: [
        .library(name: "SpaceUI", targets: ["SpaceUI"])
    ],
    targets: [
        .target(name: "SpaceUI"),
        .testTarget(name: "SpaceUITests", dependencies: ["SpaceUI"]),
    ]
)
