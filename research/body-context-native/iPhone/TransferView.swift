import SwiftUI
import UniformTypeIdentifiers
import CollectorCore

struct TransferDocument: FileDocument {
    static var readableContentTypes: [UTType] { [.data] }
    var bytes: Data
    init(bytes: Data) { self.bytes=bytes }
    init(configuration: ReadConfiguration) throws { bytes=configuration.file.regularFileContents ?? Data() }
    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper { FileWrapper(regularFileWithContents:bytes) }
}
struct TransferView: View {
    let healthQueue: ProtectedQueue?
    let healthEnabled: Bool
    let sharedStore: TransferStore?
    var sharedMockQueue: ProtectedQueue? = nil
    @State private var mockQueue: ProtectedQueue?
    @State private var store: TransferStore?
    @State private var pending: PendingTransfer?
    @State private var status = "Ready. No transfer prepared."
    @State private var working = false
    @State private var exporting = false
    @State private var importing = false
    @State private var showKey = false
    @Environment(\.scenePhase) private var scenePhase
    var body: some View {
        Section("Encrypted transfer to your Vault") {
            Text(status).accessibilityLabel("Transfer status: \(status)")
            Text("Prepare at most 200 deliveries. Save the encrypted file locally, transfer it to your Mac, and enter the separate key in XR → iPhone → private Vault transfer. Do not use iCloud or send the key in chat.")
            Button("Prepare fictional transfer") { Task { await prepare(fictional:true) } }.disabled(working || pending != nil)
            Button("Prepare selected Health transfer") { Task { await prepare(fictional:false) } }.disabled(working || pending != nil || !healthEnabled || healthQueue == nil)
            if let pending {
                Text("\(pending.mode == "simulated" ? "Fictional" : "HealthKit") batch · \(pending.deliveryIDs.count) deliveries awaiting Vault review")
                Button("Save encrypted batch") { Task { await refreshPending();exporting=self.pending != nil } }.disabled(working)
                Toggle("Show separate transfer key",isOn:$showKey)
                if showKey { Text(pending.keyText).font(.caption.monospaced()).textSelection(.enabled).accessibilityLabel("Separate transfer key: \(pending.keyText)") }
                Text("After accepting evidence in the Vault, download its acknowledgement receipt and return that file here. Saving or sharing the batch does not clear the queue.")
                Button("Import Vault acknowledgement") { importing=true }.disabled(working)
                Button("Discard prepared export",role:.destructive) { Task { await discard() } }.disabled(working)
                Text("Discarding keeps queued samples. Delete any exported copies yourself.")
            }
        }
        .task {
            await restore()
            while !Task.isCancelled {
                do { try await Task.sleep(nanoseconds:5_000_000_000) } catch { return }
                if !working && !exporting && !importing { await refreshPending() }
            }
        }
        .onChange(of:scenePhase) { _, phase in if phase != .active { showKey=false } }
        .fileExporter(isPresented:$exporting,document:pending.map { TransferDocument(bytes:$0.envelope) },contentType:.data,defaultFilename:"storywalker-batch.swtransfer") { result in
            switch result { case .success: status="Encrypted file saved. Queue retained until a valid Vault receipt returns."; case .failure: status="Export cancelled or unavailable. Queue retained." }
        }
        .fileImporter(isPresented:$importing,allowedContentTypes:[.json],allowsMultipleSelection:false) { result in
            Task { await receive(result) }
        }
    }
    private func setup() throws -> (ProtectedQueue,TransferStore) {
        let directory=try FileManager.default.url(for:.applicationSupportDirectory,in:.userDomainMask,appropriateFor:nil,create:true)
        return (try sharedMockQueue ?? ProtectedQueue(url:directory.appendingPathComponent("fictional-transfer-queue.plist")),sharedStore ?? TransferStore(url:directory.appendingPathComponent("pending-transfer.plist")))
    }
    private func restore() async {
        do { let (mock,transfer)=try setup();mockQueue=mock;store=transfer;pending=try await transfer.current();if pending != nil { status="Prepared batch restored. Continue export or import its Vault receipt." } }
        catch { status="Protected transfer storage unavailable. Unlock the phone and retry." }
    }
    private func refreshPending() async {
        guard pending != nil,let store else { return }
        do {
            if try await store.current() == nil {
                pending=nil;showKey=false
                status="Prepared batch invalidated by source deletion. Delete any external copies, then prepare a new batch including the deletion."
            }
        } catch { showKey=false;status="Unlock the phone to check protected transfer storage." }
    }
    private func prepare(fictional:Bool) async {
        working=true;defer{working=false};showKey=false
        do {
            if store == nil { await restore() }
            guard let store, let queue=fictional ? mockQueue : healthQueue else { throw TransferError.invalid }
            if fictional {
                var snapshot=await queue.snapshot()
                let deliveries=try FictionalCollector.packets().map { data -> Delivery in
                    let object=try JSONSerialization.jsonObject(with:data) as! [String:Any]
                    return Delivery(id:object["id"] as! String,packet:data)
                }
                try snapshot.append(deliveries,anchor:nil);try await queue.commit(snapshot)
            }
            pending=try await store.prepare(queue:queue,mode:fictional ? "simulated" : "healthkit")
            status="Done. Encrypted batch ready; no samples acknowledged yet."
        } catch { status="Could not prepare transfer. Queue may be empty or busy; refresh and retry." }
    }
    private func receive(_ result: Result<[URL],Error>) async {
        working=true;defer{working=false};showKey=false
        do {
            guard let url=try result.get().first,let pending,let store,let queue=pending.mode == "simulated" ? mockQueue : healthQueue else { throw TransferError.invalid }
            let granted=url.startAccessingSecurityScopedResource();defer{if granted{url.stopAccessingSecurityScopedResource()}}
            let size=try url.resourceValues(forKeys:[.fileSizeKey]).fileSize ?? 4097
            guard size<=4096 else { throw TransferError.invalid }
            let handle=try FileHandle(forReadingFrom:url);defer{try? handle.close()}
            let data=try handle.read(upToCount:4097) ?? Data()
            try await store.acknowledge(data,queue:queue)
            self.pending=nil;status="Done. Vault receipt verified; this batch removed from the phone queue. Delete transferred files after checking the Vault."
        } catch { status="Receipt not accepted. Wrong batch, altered file, or queue changed. All unacknowledged samples retained." }
    }
    private func discard() async {
        do { try await store?.discard();pending=nil;showKey=false;status="Prepared export removed from this app. Queued observations retained." }
        catch { status="Could not discard export." }
    }
}
