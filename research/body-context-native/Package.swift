// swift-tools-version: 5.9
import PackageDescription
let package = Package(name: "StorywalkerCollector", platforms: [.iOS(.v17), .macOS(.v14)], products: [.library(name: "CollectorCore", targets: ["CollectorCore"]), .executable(name: "collector-dry-run", targets: ["CollectorDryRun"])], targets: [.target(name: "CollectorCore"), .executableTarget(name: "CollectorDryRun", dependencies: ["CollectorCore"]), .testTarget(name: "CollectorCoreTests", dependencies: ["CollectorCore"])])
