import Foundation
import CollectorCore

@main struct CollectorDryRun {
    static func main() async {
        do { try await execute() }
        catch {
            let error=error as NSError
            let code=error.domain == NSURLErrorDomain ? "NETWORK_\(error.code)" : "REHEARSAL_FAILED"
            FileHandle.standardError.write(Data((code+"\n").utf8));exit(2)
        }
    }
    static func execute() async throws {
        // Only fictional fixtures are supported; network access requires the explicit loopback rehearsal option.
        if CommandLine.arguments.count == 3, CommandLine.arguments[1] == "--transfer-fixture" {
            let folder=URL(fileURLWithPath:CommandLine.arguments[2],isDirectory:true)
            try FileManager.default.createDirectory(at:folder,withIntermediateDirectories:true,attributes:[.posixPermissions:0o700])
            let queue=try ProtectedQueue(url:folder.appendingPathComponent("fictional-queue.plist"))
            var snapshot=await queue.snapshot()
            let deliveries=try FictionalCollector.packets().map { data -> Delivery in
                let object=try JSONSerialization.jsonObject(with:data) as! [String:Any]
                return Delivery(id:object["id"] as! String,packet:data)
            }
            try snapshot.append(deliveries,anchor:nil);try await queue.commit(snapshot)
            let store=TransferStore(url:folder.appendingPathComponent("pending-transfer.plist"))
            let pending=try await store.prepare(queue:queue,mode:"simulated")
            try pending.envelope.write(to:folder.appendingPathComponent("fictional.swtransfer"),options:.atomic)
            let keyURL=folder.appendingPathComponent("fictional-test-key.txt")
            try Data(pending.keyText.utf8).write(to:keyURL,options:.atomic)
            try FileManager.default.setAttributes([.posixPermissions:0o600],ofItemAtPath:keyURL.path)
            print("Fictional transfer fixture prepared: 14 unique deliveries. Key stays in the selected test directory.")
            return
        }
        if CommandLine.arguments.count == 3, ["--network-fixture","--stream-network-fixture"].contains(CommandLine.arguments[1]) {
            let folder=URL(fileURLWithPath:CommandLine.arguments[2],isDirectory:true)
            let pairing=try JSONDecoder().decode(MacPairing.self,from:Data(contentsOf:folder.appendingPathComponent("pairing.json")))
            guard pairing.mode == "simulated",URL(string:pairing.endpoint)?.host == "127.0.0.1" else {throw TransferError.invalid}
            let queue=try ProtectedQueue(url:folder.appendingPathComponent("fictional-queue.plist"))
            let store=TransferStore(url:folder.appendingPathComponent("pending-transfer.plist"))
            guard let pending=try await store.current(),pending.mode == "simulated" else {throw TransferError.invalid}
            let receipt:Data?
            if CommandLine.arguments[1] == "--stream-network-fixture" {
                let client=PairedMacConnection(allowLoopback:true)
                do {
                    let staged=try await client.send(.deliver,pending:pending,to:pairing)
                    receipt=try await client.send(.receipt,pending:pending,to:pairing)
                    guard (staged == nil) == (receipt == nil) else{throw TransferError.invalid}
                    await client.close()
                } catch {await client.close();throw error}
            } else {receipt=try await PairedMacClient.deliver(pending,to:pairing,allowLoopback:true)}
            if let receipt{
                try await store.acknowledge(receipt,queue:queue)
                guard await queue.snapshot().pending.isEmpty else{throw TransferError.invalid}
                print("Fictional HTTPS receipt verified; queue empty.")
            }else{print("Fictional HTTPS batch staged; queue retained.")}
            return
        }
        if CommandLine.arguments.count == 3, CommandLine.arguments[1] == "--verify-fixture-receipt" {
            let folder=URL(fileURLWithPath:CommandLine.arguments[2],isDirectory:true)
            let queue=try ProtectedQueue(url:folder.appendingPathComponent("fictional-queue.plist"))
            let store=TransferStore(url:folder.appendingPathComponent("pending-transfer.plist"))
            guard try await store.current()?.mode == "simulated" else { throw TransferError.invalid }
            try await store.acknowledge(Data(contentsOf:folder.appendingPathComponent("storywalker-receipt.json")),queue:queue)
            guard await queue.snapshot().pending.isEmpty else { throw TransferError.invalid }
            print("Fictional receipt verified by Swift; queue acknowledged and empty.")
            return
        }
        guard CommandLine.arguments.count == 1 else { throw TransferError.invalid }
        guard try await FictionalCollector.checkQueue() == 14 else { throw QueueError.stale }
        for packet in try FictionalCollector.packets() {
            FileHandle.standardOutput.write(packet)
            FileHandle.standardOutput.write(Data([10]))
        }
    }
}
