import XCTest
@testable import CollectorCore
final class AutomaticTransferTests:XCTestCase {
    func testDeliveryErrorsDistinguishRecoveryWithoutLeakingDetails(){
        let refused=NSError(domain:NSURLErrorDomain,code:NSURLErrorCannotConnectToHost,userInfo:[NSLocalizedDescriptionKey:"SECRET-CANARY"])
        XCTAssertTrue(MacDeliveryFailure.message(refused).contains("Cannot connect"))
        XCTAssertTrue(MacDeliveryFailure.message(MacDeliveryError.locked).contains("Vault is locked"))
        XCTAssertTrue(MacDeliveryFailure.message(MacDeliveryError.rejected).contains("rejected this pairing"))
        XCTAssertTrue(MacDeliveryFailure.message(MacDeliveryError.invalidReceipt).contains("not acknowledged"))
        for error:Error in [refused,MacDeliveryError.invalidBatch,NSError(domain:"SECRET-CANARY",code:1,userInfo:[NSLocalizedDescriptionKey:"SECRET-CANARY"])] {
            XCTAssertFalse(MacDeliveryFailure.message(error).contains("SECRET-CANARY"))
        }
    }
    func data(endpoint:String="https://192.168.1.2:8766/transfer",mode:String="simulated",pin:String=String(repeating:"a",count:64))->Data{
        try! JSONSerialization.data(withJSONObject:["version":1,"endpoint":endpoint,"mode":mode,"token":Data(repeating:1,count:32).base64EncodedString(),"certificate_sha256":pin])
    }
    func testRejectsUnpairedDestinationsAndMalformedPins()throws{
        for url in ["http://192.168.1.2:8766/transfer","https://example.com:8766/transfer","https://192.168.1.2:8766/other","https://user@192.168.1.2:8766/transfer","https://192.168.1.2:8766/transfer?key=secret"] {
            XCTAssertThrowsError(try JSONDecoder().decode(MacPairing.self,from:data(endpoint:url)).validated())
        }
        XCTAssertThrowsError(try JSONDecoder().decode(MacPairing.self,from:data(pin:"bad")).validated())
        XCTAssertNoThrow(try JSONDecoder().decode(MacPairing.self,from:data()).validated())
    }
    func testPairingPausedByDefaultResumeAndForget()async throws{
        let folder=FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer{try? FileManager.default.removeItem(at:folder)}
        let url=folder.appendingPathComponent("pairing.plist"),sender=try AutomaticTransfer(url:url)
        try await sender.install(data());let initial=await sender.enabled();XCTAssertFalse(initial)
        try await sender.start();let restarted=try AutomaticTransfer(url:url);let active=await restarted.enabled();XCTAssertTrue(active)
        try await restarted.stop();let paused=try AutomaticTransfer(url:url);let disabled=await paused.enabled();XCTAssertFalse(disabled)
        try await paused.stop(forget:true);XCTAssertFalse(FileManager.default.fileExists(atPath:url.path))
    }
    func testSourceModeMismatchKeepsQueue()async throws{
        let folder=FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer{try? FileManager.default.removeItem(at:folder)}
        let queue=try ProtectedQueue(url:folder.appendingPathComponent("queue.plist")),store=TransferStore(url:folder.appendingPathComponent("transfer.plist"))
        var snapshot=await queue.snapshot();try snapshot.append([Delivery(id:"invented",packet:Data("fictional".utf8))],anchor:nil);try await queue.commit(snapshot)
        let pending=try await store.prepare(queue:queue,mode:"simulated")
        let config=try JSONDecoder().decode(MacPairing.self,from:data(mode:"healthkit"))
        do{_ = try await PairedMacClient.deliver(pending,to:config);XCTFail("mode mismatch accepted")}catch{}
        let count=await queue.snapshot().pending.count;XCTAssertEqual(count,1)
    }
    func testFailedOptInPersistenceDoesNotEnableDelivery()async throws{
        let folder=FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer{try? FileManager.default.removeItem(at:folder)}
        let sender=try AutomaticTransfer(url:folder.appendingPathComponent("pairing.plist"))
        try await sender.install(data())
        try FileManager.default.removeItem(at:folder)
        try Data("not a directory".utf8).write(to:folder)
        do{try await sender.start();XCTFail("write should fail")}catch{}
        let active=await sender.enabled();XCTAssertFalse(active)
    }
}

final class CompanionPreviewTests:XCTestCase {
    func testLatestAvailableWatchReadingPreservesAgeAndRespectsDeletionAndPause()throws{
        let now=Date()
        func item(_ id:String,_ age:Double,_ watch:Bool=true)throws->Delivery{
            Delivery(id:id,packet:try ObservationMapping.heart(id:id,source:"test",revision:"1",start:now.addingTimeInterval(-age),end:now.addingTimeInterval(-age),received:now,value:127.3,originalTimezone:nil,acquisition:.historical,watchRecorded:watch))
        }
        var snapshot=QueueSnapshot()
        snapshot.collection=CollectionSelection(since:now.addingTimeInterval(-86400),enabled:true)
        snapshot.pending=[try item("old",300),try item("phone",1,false),try item("watch",20),try item("future",-30)]
        XCTAssertEqual(CompanionPreview.latest(snapshot,now:now)?.id,"watch")
        snapshot.pending.append(Delivery(id:"delete:watch",deletion:true,packet:Data("watch".utf8)))
        XCTAssertEqual(CompanionPreview.latest(snapshot,now:now)?.id,"old")
        snapshot.pending.append(Delivery(id:"delete:old",deletion:true,packet:Data("old".utf8)))
        XCTAssertNil(CompanionPreview.latest(snapshot,now:now))
        snapshot.pending=[try item("watch",20)];snapshot.collection?.enabled=false
        XCTAssertNil(CompanionPreview.latest(snapshot,now:now))
    }
}

private actor RecordingMacTransport:MacDeliveryTransport {
    var actions:[MacRequestAction]=[]
    var failNext:MacDeliveryError?
    var response:Data?
    var closes=0
    func send(_ action:MacRequestAction,pending:PendingTransfer?,to pairing:MacPairing)async throws->Data? {
        actions.append(action)
        if let failure=failNext{failNext=nil;throw failure}
        if action == .heartbeat || action == .preview{return Data("previewed".utf8)}
        return response
    }
    func close(){closes+=1}
    func fail(_ error:MacDeliveryError){failNext=error}
    func respond(_ value:Data?){response=value}
}
final class StreamingDeliveryTests:XCTestCase {
    func pairing(_ mode:String)throws->Data {
        try JSONSerialization.data(withJSONObject:["version":1,"endpoint":"https://192.168.1.2:8766/transfer","mode":mode,"token":Data(repeating:1,count:32).base64EncodedString(),"certificate_sha256":String(repeating:"a",count:64)])
    }
    func testConfirmedStageUsesReceiptOnlyAndMissingStageResendsRetainedEnvelope()async throws {
        let folder=FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer{try? FileManager.default.removeItem(at:folder)}
        let transport=RecordingMacTransport(),sender=try AutomaticTransfer(url:folder.appendingPathComponent("pairing"),transport:transport)
        let queue=try ProtectedQueue(url:folder.appendingPathComponent("queue")),store=TransferStore(url:folder.appendingPathComponent("pending"))
        var snapshot=await queue.snapshot();snapshot.pending=[Delivery(id:"fictional",packet:Data("fictional".utf8))];try await queue.commit(snapshot)
        try await sender.install(pairing("simulated"));try await sender.start()
        let now=Date();await sender.tick(queue:queue,store:store,now:now)
        let digest=try await store.current()?.digest
        await sender.tick(queue:queue,store:store,now:now.addingTimeInterval(16))
        var actions=await transport.actions;XCTAssertEqual(actions,[.deliver,.receipt])
        await transport.fail(.missingBatch)
        await sender.tick(queue:queue,store:store,now:now.addingTimeInterval(32))
        actions=await transport.actions;XCTAssertEqual(actions,[.deliver,.receipt,.receipt,.deliver])
        let retained=try await store.current()?.digest,count=await queue.snapshot().pending.count
        XCTAssertEqual(retained,digest);XCTAssertEqual(count,1)
        await transport.respond(Data("invalid receipt".utf8))
        await sender.tick(queue:queue,store:store,now:now.addingTimeInterval(48))
        let safe=await queue.snapshot().pending.count;XCTAssertEqual(safe,1)
    }
    func testReceiptAndHeartbeatMessagesExcludeHealthEnvelopeAndKey()throws {
        var snapshot=QueueSnapshot();snapshot.pending=[Delivery(id:"fictional",packet:Data("health-canary".utf8))]
        let pending=try TransferCodec.prepare(snapshot,mode:"simulated")
        let receipt=try JSONSerialization.jsonObject(with:PairedMacConnection.body(.receipt,pending:pending)) as! [String:String]
        XCTAssertEqual(receipt,["action":"receipt","id":"native:batch:"+pending.batchID])
        let heartbeat=try JSONSerialization.jsonObject(with:PairedMacConnection.body(.heartbeat,pending:nil)) as! [String:String]
        XCTAssertEqual(heartbeat,["action":"heartbeat"])
        XCTAssertThrowsError(try PairedMacConnection.result(Data("{\"status\":\"deleted\"}".utf8),action:.receipt,pending:pending))
    }
    func testPreviewSendsNewIDsOnceHeartbeatsDuplicatesPropagatesDeletionAndBacksOff()async throws {
        let folder=FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer{try? FileManager.default.removeItem(at:folder)}
        let transport=RecordingMacTransport(),sender=try AutomaticTransfer(url:folder.appendingPathComponent("pairing"),transport:transport)
        let queue=try ProtectedQueue(url:folder.appendingPathComponent("queue")),now=Date()
        func sample(_ id:String)throws->Delivery {
            Delivery(id:id,packet:try ObservationMapping.heart(id:id,source:"test",revision:"1",start:now.addingTimeInterval(-5),end:now.addingTimeInterval(-5),received:now,value:82.4,originalTimezone:nil,acquisition:.historical,watchRecorded:true))
        }
        var snapshot=await queue.snapshot();snapshot.collection=CollectionSelection(since:now.addingTimeInterval(-86400),enabled:true);snapshot.pending=[try sample("watch")];try await queue.commit(snapshot)
        try await sender.install(pairing("healthkit"));try await sender.start();try await sender.setPreviewEnabled(true)
        await sender.previewTick(queue:queue,now:now)
        await sender.previewTick(queue:queue,now:now.addingTimeInterval(5))
        var actions=await transport.actions;XCTAssertEqual(actions,[.preview,.heartbeat])
        snapshot=await queue.snapshot();try snapshot.append([Delivery(id:"delete:watch",deletion:true,packet:Data("watch".utf8))],anchor:nil);try await queue.commit(snapshot)
        await sender.previewTick(queue:queue,now:now.addingTimeInterval(10))
        actions=await transport.actions;XCTAssertEqual(actions,[.preview,.heartbeat,.preview,.heartbeat])
        await sender.previewTick(queue:queue,now:now.addingTimeInterval(15))
        actions=await transport.actions;XCTAssertEqual(actions.last,.heartbeat)
        await transport.fail(.locked)
        await sender.previewTick(queue:queue,now:now.addingTimeInterval(20))
        let failedCount=await transport.actions.count
        await sender.previewTick(queue:queue,now:now.addingTimeInterval(21))
        let backedOff=await transport.actions.count;XCTAssertEqual(backedOff,failedCount)
        await sender.previewTick(queue:queue,now:now.addingTimeInterval(25))
        let retried=await transport.actions.count;XCTAssertGreaterThan(retried,backedOff)
        try await sender.stop();let stopped=await transport.actions.count
        await sender.previewTick(queue:queue,now:now.addingTimeInterval(100))
        let afterStop=await transport.actions.count,closes=await transport.closes
        XCTAssertEqual(afterStop,stopped);XCTAssertEqual(closes,2)
    }
}
