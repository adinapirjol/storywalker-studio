import XCTest
@testable import CollectorCore

final class DryRunTests: XCTestCase {
    func testFictionalQueueRecoveryEncryptionAndAcknowledgement() async throws {
        let count = try await FictionalCollector.checkQueue()
        XCTAssertEqual(count, 14)
    }
    func testFictionalMappingIsExplicitAndRepeatable() throws {
        let first = try FictionalCollector.packets()
        let second = try FictionalCollector.packets()
        XCTAssertEqual(first.count, 17)
        for (a,b) in zip(first,second) {
            let one = try JSONSerialization.jsonObject(with:a) as! NSDictionary
            let two = try JSONSerialization.jsonObject(with:b) as! NSDictionary
            XCTAssertEqual(one,two)
            XCTAssertEqual(one["acquisition"] as? String,"simulated")
            XCTAssertEqual(one["source_type"] as? String,"fictional")
        }
    }
    func testEncryptedExportRejectsTampering() throws {
        let key = Data(repeating: 7, count: 32)
        var encrypted = try EncryptedExport.seal(QueueSnapshot(), key:key)
        encrypted[encrypted.count-1] ^= 1
        XCTAssertThrowsError(try EncryptedExport.open(encrypted,key:key))
    }
}
