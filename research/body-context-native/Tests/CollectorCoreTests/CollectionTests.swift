import XCTest
@testable import CollectorCore
final class CollectionTests:XCTestCase {
    func testOptInPauseResumePersistsSamePredicateAndAnchor() async throws {
        let url=FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at:url) }
        let q=try ProtectedQueue(url:url),since=Date(timeIntervalSince1970:1000)
        XCTAssertNil(q.launchSelection)
        try await q.selectCollection(since:since)
        var snapshot=await q.snapshot();snapshot.anchor=Data([1]);try await q.commit(snapshot)
        try await q.pauseCollection()
        let reopened=try ProtectedQueue(url:url)
        XCTAssertEqual(reopened.launchSelection?.enabled,false)
        try await reopened.selectCollection(since:since.addingTimeInterval(9999))
        let resumed=await reopened.snapshot()
        XCTAssertEqual(resumed.collection?.since,since)
        XCTAssertEqual(resumed.collection?.enabled,true)
        XCTAssertEqual(resumed.anchor,Data([1]))
        do { try await reopened.commit(snapshot);XCTFail("stale snapshot restored") } catch QueueError.stale {}
        try await reopened.clear()
        let cleared=await reopened.snapshot()
        XCTAssertNil(cleared.collection);XCTAssertNil(cleared.anchor)
    }
    func testQueueFullNeverAdvancesAnchor() throws {
        var s=QueueSnapshot()
        try s.append((0..<10000).map { Delivery(id:String($0)) },anchor:Data([1]))
        XCTAssertThrowsError(try s.append([Delivery(id:"overflow")],anchor:Data([2])))
        XCTAssertEqual(s.anchor,Data([1]));XCTAssertEqual(s.pending.count,10000)
    }
    func testLegacySnapshotHasCollectionOff() throws {
        let bytes=try PropertyListSerialization.data(fromPropertyList:["epoch":0,"pending":[],"failures":0],format:.binary,options:0)
        let s=try PropertyListDecoder().decode(QueueSnapshot.self,from:bytes)
        XCTAssertNil(s.collection)
    }
    func testReviewPreservesExtremeReadingLagAndWatchProvenance() throws {
        let d=Date(timeIntervalSince1970:1000)
        let packet=try ObservationMapping.heart(id:"test",source:"fictional.source",revision:"1",start:d,end:d,received:d.addingTimeInterval(60),value:500,originalTimezone:nil,acquisition:.historical,watchRecorded:true)
        var s=QueueSnapshot();try s.append([Delivery(id:"test",packet:packet)],anchor:nil)
        let r=try XCTUnwrap(HeartReview.recent(s).first)
        XCTAssertEqual(r.deliveryLag,60);XCTAssertEqual(r.bpm,500);XCTAssertTrue(r.watchRecorded)
        try s.append([Delivery(id:"delete:test",deletion:true,packet:Data("test".utf8))],anchor:nil)
        XCTAssertTrue(HeartReview.recent(s).isEmpty)
    }
}

final class HealthDeletionTests:XCTestCase {
    func testDeletionPurgesQueuedPayloadAndInvalidatesPreparedHealthCopy() async throws {
        let dir=FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at:dir) }
        let q=try ProtectedQueue(url:dir.appendingPathComponent("q")),transfers=TransferStore(url:dir.appendingPathComponent("t"))
        var state=await q.snapshot();state.lastMeasurementID="sample";state.lastMeasurement=Date();state.lastReceived=Date()
        try state.append([Delivery(id:"sample",packet:Data("fictional-private-canary".utf8))],anchor:Data([1]))
        try await q.commit(state)
        _ = try await transfers.prepare(queue:q,mode:"healthkit")
        state=await q.snapshot()
        try state.append([Delivery(id:"delete:sample",deletion:true,packet:Data("sample".utf8))],anchor:Data([2]))
        try await transfers.invalidateDeletedSources(["sample"])
        try await q.commit(state)
        let current=try await transfers.current();XCTAssertNil(current)
        let after=await q.snapshot();XCTAssertEqual(after.pending.map(\.id),["delete:sample"])
        XCTAssertNil(after.lastMeasurement);XCTAssertNil(after.lastReceived)
        XCTAssertFalse(String(decoding:try PropertyListEncoder().encode(after),as:UTF8.self).contains("fictional-private-canary"))
    }
}
