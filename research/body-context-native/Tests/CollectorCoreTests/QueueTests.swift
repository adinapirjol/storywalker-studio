import XCTest
@testable import CollectorCore
final class QueueTests: XCTestCase {
    func testDuplicateAndAcknowledgement() throws {
        var state = QueueSnapshot()
        let item = Delivery(id: "synthetic-1", packet:Data("fictional".utf8))
        try state.append([item],anchor:Data([1]))
        try state.append([item],anchor:Data([2]))
        XCTAssertEqual(state.pending.count,1)
        state.acknowledge([item.id]); XCTAssertTrue(state.pending.isEmpty)
        XCTAssertEqual(state.anchor,Data([2]))
    }
    func testBoundedRetry() { var state = QueueSnapshot(); for _ in 0..<100 {state.failed()}; XCTAssertEqual(state.retryDelay,60) }
}
final class MappingTests: XCTestCase {
    func testExtremeValueAndUnknownOriginalTimezone() throws {
        let date=Date(timeIntervalSince1970:1000)
        let bytes=try ObservationMapping.heart(id:"fictional",source:"test",revision:"1",start:date,end:date,received:date.addingTimeInterval(60),value:500,originalTimezone:nil)
        let object=try JSONSerialization.jsonObject(with:bytes) as! [String:Any]
        XCTAssertEqual(object["original_offset"] as? String,"unknown")
        XCTAssertEqual((object["payload"] as? [String:Any])?["value"] as? Double,500)
        XCTAssertNotEqual(object["event_start"] as? String,object["received_at"] as? String)
    }
    func testRejectsNonFinite() { let date=Date();XCTAssertThrowsError(try ObservationMapping.heart(id:"fictional",source:"test",revision:"1",start:date,end:date,received:date,value:.infinity,originalTimezone:nil)) }
}
