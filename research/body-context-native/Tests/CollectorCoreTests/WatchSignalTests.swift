import XCTest
@testable import CollectorCore

final class WatchSignalTests:XCTestCase {
    func testFreshWatchMessagePreservesFractionalValueAndRejectsStaleFutureAndExtras()throws {
        let now=Date(timeIntervalSince1970:2000)
        let signal=WatchSignal(bpm:74.309776,measured:now.addingTimeInterval(-2),origin:"watch-workout")
        let decoded=try WatchSignal.decode(signal.encoded(),now:now)
        XCTAssertEqual(decoded.bpm,74.309776);XCTAssertEqual(decoded.measured,signal.measured)
        XCTAssertThrowsError(try WatchSignal.decode(WatchSignal(bpm:80,measured:now.addingTimeInterval(-121),origin:"watch-health").encoded(),now:now))
        XCTAssertThrowsError(try WatchSignal.decode(WatchSignal(bpm:80,measured:now.addingTimeInterval(1),origin:"watch-health").encoded(),now:now))
        XCTAssertThrowsError(try WatchSignal.decode(WatchSignal(bpm:80,measured:now,origin:"phone").encoded(),now:now))
        var fields=try JSONSerialization.jsonObject(with:signal.encoded()) as! [String:Any];fields["location"]="private-canary"
        XCTAssertThrowsError(try WatchSignal.decode(JSONSerialization.data(withJSONObject:fields),now:now))
        XCTAssertThrowsError(try WatchSignal.decode(Data(repeating:0,count:2049),now:now))
    }
}
private actor WatchRecordingTransport:MacDeliveryTransport {
    var actions:[MacRequestAction]=[]
    var ids:[String]=[]
    func send(_ action:MacRequestAction,pending:PendingTransfer?,to pairing:MacPairing)async throws->Data? {
        actions.append(action);ids += pending?.deliveryIDs ?? [];return Data("previewed".utf8)
    }
    func close(){}
}
final class DirectWatchPreviewTests:XCTestCase {
    func testDirectSampleRequiresOptInAndNeverEntersDurableEvidenceQueue()async throws {
        let folder=FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer{try? FileManager.default.removeItem(at:folder)}
        let queue=try ProtectedQueue(url:folder.appendingPathComponent("queue")),transport=WatchRecordingTransport()
        let sender=try AutomaticTransfer(url:folder.appendingPathComponent("pairing"),transport:transport)
        let pairing=try JSONSerialization.data(withJSONObject:["version":1,"endpoint":"https://192.168.1.2:8766/transfer","mode":"healthkit","token":Data(repeating:1,count:32).base64EncodedString(),"certificate_sha256":String(repeating:"a",count:64)])
        let now=Date(),signal=WatchSignal(bpm:82.4,measured:now.addingTimeInterval(-1),origin:"watch-workout")
        try await sender.install(pairing);try await sender.start()
        try await sender.offerWatchSignal(signal,queue:queue,now:now)
        var actions=await transport.actions;XCTAssertTrue(actions.isEmpty)
        try await sender.setPreviewEnabled(true)
        try await sender.offerWatchSignal(signal,queue:queue,now:now)
        actions=await transport.actions;XCTAssertTrue(actions.isEmpty)
        try await queue.selectCollection(since:now.addingTimeInterval(-3600))
        try await sender.offerWatchSignal(signal,queue:queue,now:now)
        actions=await transport.actions;XCTAssertEqual(actions,[.preview])
        let ids=await transport.ids;XCTAssertEqual(ids,["watch-live:"+signal.id])
        let evidence=await queue.snapshot().pending;XCTAssertTrue(evidence.isEmpty)
        try await sender.offerWatchSignal(signal,queue:queue,now:now)
        actions=await transport.actions;XCTAssertEqual(actions,[.preview])
        try await sender.setPreviewEnabled(false)
        try await sender.offerWatchSignal(WatchSignal(bpm:90,measured:now,origin:"watch-workout"),queue:queue,now:now)
        actions=await transport.actions;XCTAssertEqual(actions,[.preview])
    }
}
