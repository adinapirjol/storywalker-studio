import XCTest
import CryptoKit
@testable import CollectorCore
final class TransferTests: XCTestCase {
    private func receipt(_ pending:PendingTransfer, digest:String?=nil) throws -> Data {
        let hash=digest ?? pending.digest
        let message=Data("storywalker-receipt-v1\n\(pending.batchID)\n\(hash)\naccepted-evidence".utf8)
        let mac=Data(HMAC<SHA256>.authenticationCode(for:message,using:SymmetricKey(data:pending.key))).base64EncodedString()
        return try JSONSerialization.data(withJSONObject:["version":1,"batch_id":pending.batchID,"envelope_sha256":hash,"status":"accepted-evidence","mac":mac])
    }
    func testWireExcludesAnchorAndBindsReceipt() throws {
        var state=QueueSnapshot();try state.append([Delivery(id:"mock",packet:Data("test".utf8))],anchor:Data("private-anchor".utf8))
        let transfer=try TransferCodec.prepare(state,mode:"simulated")
        let bytes=try AES.GCM.open(AES.GCM.SealedBox(combined:transfer.envelope),using:SymmetricKey(data:transfer.key),authenticating:Data("storywalker-transfer-v1".utf8))
        XCTAssertFalse(String(decoding:bytes,as:UTF8.self).contains("anchor"))
        try TransferCodec.verify(receipt(transfer),pending:transfer)
        XCTAssertThrowsError(try TransferCodec.verify(receipt(transfer,digest:String(repeating:"0",count:64)),pending:transfer))
        var tampered=try receipt(transfer);tampered[0]=0
        XCTAssertThrowsError(try TransferCodec.verify(tampered,pending:transfer))
    }
    func testBoundedBatchAndEmptyQueue() throws {
        XCTAssertThrowsError(try TransferCodec.prepare(QueueSnapshot(),mode:"simulated"))
        var state=QueueSnapshot();try state.append((0..<201).map { Delivery(id:"mock-\($0)",packet:Data()) },anchor:nil)
        XCTAssertEqual(try TransferCodec.prepare(state,mode:"simulated").deliveryIDs.count,200)
    }
    func testRestartReceiptAndConcurrentDelivery() async throws {
        let dir=FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString);defer{try? FileManager.default.removeItem(at:dir)}
        let q=try ProtectedQueue(url:dir.appendingPathComponent("queue"));let store=TransferStore(url:dir.appendingPathComponent("transfer"))
        var state=await q.snapshot();try state.append([Delivery(id:"first",packet:Data())],anchor:Data([1]));try await q.commit(state)
        let pending=try await store.prepare(queue:q,mode:"simulated")
        let resumed=TransferStore(url:dir.appendingPathComponent("transfer"));let restored=try await resumed.current()
        XCTAssertEqual(restored?.envelope,pending.envelope)
        state=await q.snapshot();try state.append([Delivery(id:"second",packet:Data())],anchor:Data([2]));try await q.commit(state)
        // A stale writer must not restore acknowledged data or drop new deliveries.
        do { try await q.commit(state);XCTFail("stale writer allowed") } catch QueueError.stale {}
        try await resumed.acknowledge(receipt(pending),queue:q)
        let after=await q.snapshot();XCTAssertEqual(after.pending.map(\.id),["second"]);XCTAssertEqual(after.anchor,Data([2]))
    }
    func testReceiptAfterClearCannotRemoveNewQueue() async throws {
        let dir=FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString);defer{try? FileManager.default.removeItem(at:dir)}
        let q=try ProtectedQueue(url:dir.appendingPathComponent("queue"));let store=TransferStore(url:dir.appendingPathComponent("transfer"))
        var state=await q.snapshot();try state.append([Delivery(id:"same",packet:Data())],anchor:nil);try await q.commit(state)
        let pending=try await store.prepare(queue:q,mode:"simulated");try await q.clear()
        state=await q.snapshot();try state.append([Delivery(id:"same",packet:Data())],anchor:nil);try await q.commit(state)
        do { try await store.acknowledge(receipt(pending),queue:q);XCTFail("receipt from cleared epoch accepted") } catch QueueError.stale {}
        let after=await q.snapshot();XCTAssertEqual(after.pending.count,1)
    }
}
