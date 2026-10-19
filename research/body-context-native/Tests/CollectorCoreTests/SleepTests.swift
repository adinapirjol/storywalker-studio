import XCTest
@testable import CollectorCore
final class SleepTests: XCTestCase {
    func testStagesAndUnknownTimezone() throws {
        let start = Date(timeIntervalSince1970: 1000)
        for (value, name) in [0:"inBed", 1:"asleep", 2:"awake", 3:"core", 4:"deep", 5:"rem"] {
            let bytes = try ObservationMapping.sleep(id:"invented",source:"invented.watch",revision:"1",start:start,end:start.addingTimeInterval(3600),received:start.addingTimeInterval(7200),stage:value,originalTimezone:"Europe/Bucharest",watchRecorded:true,device:"invented-device")
            let obj = try XCTUnwrap(JSONSerialization.jsonObject(with:bytes) as? [String:Any])
            XCTAssertEqual((obj["payload"] as? [String:String])?["stage"], name)
            XCTAssertEqual(obj["original_offset"] as? String,"Europe/Bucharest")
            XCTAssertEqual(obj["semantics"] as? String,"interval")
            XCTAssertEqual(obj["device_revision"] as? String,"invented-device")
            XCTAssertEqual(obj["acquisition"] as? String,"historical")
        }
        XCTAssertThrowsError(try ObservationMapping.sleep(id:"x",source:"s",revision:"1",start:start,end:start,received:start,stage:3,originalTimezone:nil,watchRecorded:true,device:nil))
        XCTAssertThrowsError(try ObservationMapping.sleep(id:"x",source:"s",revision:"1",start:start,end:start.addingTimeInterval(1),received:start,stage:99,originalTimezone:nil,watchRecorded:true,device:nil))
        let bytes = try ObservationMapping.sleep(id:"x",source:"s",revision:"1",start:start,end:start.addingTimeInterval(1),received:start,stage:1,originalTimezone:nil,watchRecorded:false,device:nil)
        let obj = try XCTUnwrap(JSONSerialization.jsonObject(with:bytes) as? [String:Any])
        XCTAssertEqual(obj["original_offset"] as? String,"unknown")
        XCTAssertEqual(obj["quality"] as? [String],["original_timezone_unknown"])
    }
    func testIndependentSleepAnchor() async throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: directory) }
        let heart = try ProtectedQueue(url: directory.appendingPathComponent("heart"))
        let sleep = try ProtectedQueue(url: directory.appendingPathComponent("sleep"))
        try await heart.selectCollection(since: Date(timeIntervalSince1970: 1))
        try await sleep.selectCollection(since: Date(timeIntervalSince1970: 2))
        var a = await heart.snapshot(); a.anchor = Data([1]); try await heart.commit(a)
        var b = await sleep.snapshot(); b.anchor = Data([2]); try await sleep.commit(b)
        try await sleep.clear()
        let reopened = try ProtectedQueue(url: directory.appendingPathComponent("heart"))
        let saved = await reopened.snapshot()
        XCTAssertEqual(saved.anchor,Data([1])); XCTAssertEqual(saved.collection?.since,Date(timeIntervalSince1970:1))
    }
}
