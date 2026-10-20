import SwiftUI
import CollectorCore
import UniformTypeIdentifiers

@MainActor final class HealthSession: ObservableObject {
    static let shared=HealthSession()
    @Published private(set) var queue:ProtectedQueue?
    @Published private(set) var collector:HealthCollector?
    @Published var queueRevision=0
    @Published private(set) var watchReading:HeartReview?
    @Published var watchStatus="Direct Watch feed: waiting for the Watch app."
    private var watchBridge:PhoneWatchBridge?
    private(set) var transfers:TransferStore?
    @Published var status="Ready. Collection is off until you start it."
    @Published var transferVersion=0
    private(set) var automatic:AutomaticTransfer?
    private(set) var mockQueue:ProtectedQueue?
    @Published var previewStatus="Companion feed off."
    @Published var deliveryStatus="Automatic Mac delivery off."
    func updateDeliveryStatus() async { deliveryStatus=await automatic?.status ?? "Automatic delivery unavailable.";previewStatus=await automatic?.previewStatus ?? "Companion feed unavailable." }
    func deliver() async {
        guard let automatic,let transfers else{return}
        let selected=await automatic.mode() == "simulated" ? mockQueue : queue
        if let selected {
            let previous=try? await transfers.current()?.digest
            var background:UIBackgroundTaskIdentifier = .invalid
            background=UIApplication.shared.beginBackgroundTask(withName:"Paired evidence delivery") {
                if background != .invalid { UIApplication.shared.endBackgroundTask(background);background = .invalid }
            }
            await automatic.previewTick(queue:selected)
            await automatic.tick(queue:selected,store:transfers)
            if background != .invalid { UIApplication.shared.endBackgroundTask(background) }
            if previous != (try? await transfers.current()?.digest) { transferVersion += 1 }
        }
        await updateDeliveryStatus()
    }
    func restore() {
        guard queue == nil else { return }
        do {
            let directory=try FileManager.default.url(for:.applicationSupportDirectory,in:.userDomainMask,appropriateFor:nil,create:true)
            let local=try ProtectedQueue(url:directory.appendingPathComponent("health-queue.plist"))
            let transfer=TransferStore(url:directory.appendingPathComponent("pending-transfer.plist"));transfers=transfer
            let service=HealthCollector(queue:local,transfers:transfer)
            automatic=try AutomaticTransfer(url:directory.appendingPathComponent("mac-pairing.plist"))
            mockQueue=try ProtectedQueue(url:directory.appendingPathComponent("fictional-transfer-queue.plist"))
            service.onQueued = { [weak self] in self?.queueRevision += 1;await self?.deliver() }
            queue=local;collector=service
            watchBridge=PhoneWatchBridge(health:self)
            service.restoreAtLaunch()
            Task { await service.refreshReview() }
        } catch { status="Protected storage unavailable. Unlock the phone and reopen the app." }
    }
    func receiveWatch(_ bytes:Data) async -> Bool {
        guard let queue,(await queue.snapshot()).collection?.enabled == true else {
            watchStatus="Direct Watch arrived; start selected collection on this phone to connect it.";return false
        }
        do {
            let now=Date(),signal=try WatchSignal.decode(bytes,now:now)
            guard watchReading == nil || signal.measured>watchReading!.measured else{return false}
            // One temporary sample only. Source evidence is collected later through HealthKit.
            let packet=try ObservationMapping.heart(id:"watch-live:"+signal.id,source:"studio.storywalker.watch",revision:signal.origin,
                start:signal.measured,end:signal.measured,received:now,value:signal.bpm,originalTimezone:nil,acquisition:.live,watchRecorded:true)
            var snapshot=QueueSnapshot();snapshot.pending=[Delivery(id:"watch-live:"+signal.id,packet:packet)]
            watchReading=HeartReview.recent(snapshot).first;queueRevision += 1
            watchStatus="Direct Watch received \(now.formatted(date:.omitted,time:.standard)). Health sync bypassed for this temporary pose."
            Task { [weak self] in
                guard let self else{return}
                let background=UIApplication.shared.beginBackgroundTask(withName:"Direct Watch preview",expirationHandler:nil)
                try? await self.automatic?.offerWatchSignal(signal,queue:queue,now:now)
                await self.updateDeliveryStatus()
                if background != .invalid{UIApplication.shared.endBackgroundTask(background)}
            }
            return true
        }catch{watchStatus="Direct Watch message unavailable or stale. Waiting for a fresh reading.";return false}
    }
    func clear() async {
        do {
            try await collector?.stop()
            try await automatic?.stop()
            let directory=try FileManager.default.url(for:.applicationSupportDirectory,in:.userDomainMask,appropriateFor:nil,create:true)
            let transfer=TransferStore(url:directory.appendingPathComponent("pending-transfer.plist"))
            if try await transfer.current()?.mode == "healthkit" { try await transfer.discard() }
            try await queue?.clear();transferVersion += 1
            watchReading=nil;queueRevision += 1
            await collector?.refreshReview()
            status="Local Health queue and prepared export cleared. Health source records and desktop Vault remain unchanged. Delete exported copies separately."
        } catch { status="Could not finish clearing. Collection stopped in this session; unlock and retry to save the pause." }
    }
}
@MainActor final class CompanionDelegate:NSObject,UIApplicationDelegate {
    func application(_ application:UIApplication,didFinishLaunchingWithOptions launchOptions:[UIApplication.LaunchOptionsKey:Any]?=nil)->Bool {
        SleepSession.shared.restore()
        HealthSession.shared.restore() // Register saved opt-in observer during launch, including background launch.
        return true
    }
    func applicationProtectedDataDidBecomeAvailable(_ application:UIApplication) { HealthSession.shared.restore(); SleepSession.shared.restore() }
}
@main struct CompanionApp: App {
    @UIApplicationDelegateAdaptor(CompanionDelegate.self) private var delegate
    var body: some Scene { WindowGroup { WellbeingReview() } }
}
struct WellbeingReview:View {
    @StateObject private var health=HealthSession.shared
    @StateObject private var sleep=SleepSession.shared
    @State private var dryRunState="Ready. Fictional data only; no Health access or network."
    @State private var dryRunWorking=false
    @State private var confirmClear=false
    @State private var showConnections=false
    @Environment(\.scenePhase) private var phase
    var body:some View {
        NavigationStack {
            Form {
                PetWatchFace(health:health)
                Section {
                    Button { showConnections=true } label: {
                        Label("Connections & data",systemImage:"slider.horizontal.3")
                    }
                    Text("Collection, Watch connection, Mac delivery and private evidence review.").font(.caption).foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Storywalker · BODY").navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented:$showConnections) {
                NavigationStack {
                    Form {
                        Section("Watch connector") {
                            Text(health.watchStatus).font(.caption)
                            Text("The Watch app can send a temporary pet reading directly when this phone is reachable. Start pet readings there; start a workout only for your actual activity. Cellular service does not itself connect to the private Mac receiver.").font(.caption)
                            Button("Check available Health readings"){Task{await health.collector?.checkNow()}}
                            Text("This checks records already on the phone; it does not command Watch sampling.").font(.caption)
                        }
                        Section("Research summaries") {
                            Text("The Mac has a separate, optional Storywalker Logfire summary feed. When enabled there, it exports maximum BPM, counts and app-receipt windows; Watch readings take priority. Raw observations stay local. Manage or stop export in BODY on the Mac.").font(.caption)
                        }
                if let collector=health.collector { HealthControls(collector:collector) }
                else { Section("Health collection") { Text(health.status);Button("Retry local setup") { health.restore() } } }
                SleepObservatory(sleep:sleep)
                AutomaticDeliveryView(health:health)
                TransferView(healthQueue:health.queue,healthEnabled:true,sharedStore:health.transfers,sharedMockQueue:health.mockQueue).id(health.transferVersion)
                Section("Collection controls") {
                    Text(health.status).font(.caption)
                    Button("Clear local Health queue and prepared export",role:.destructive) { confirmClear=true }.disabled(health.queue == nil)
                    Text("Clearing stops collection and resets its selected window. To remove imported evidence, delete its batch in the desktop Vault too.").font(.caption)
                }
                Section("Fictional collector dry run") {
                    Text(dryRunState).accessibilityLabel("Dry run status: \(dryRunState)")
                    Button("Run mock collector") {
                        dryRunWorking=true;dryRunState="Working…"
                        Task {
                            do { let count=try await FictionalCollector.checkQueue();dryRunState="Done. 17 fictional deliveries, \(count) unique samples. Restart recovery, encryption and acknowledgement passed." }
                            catch { dryRunState="Failed. Fictional queue check could not complete." }
                            dryRunWorking=false
                        }
                    }.disabled(dryRunWorking)
                }
                    }.navigationTitle("Connections & data").navigationBarTitleDisplayMode(.inline)
                     .toolbar { ToolbarItem(placement:.confirmationAction) { Button("Done"){showConnections=false} } }
            .confirmationDialog("Clear queued Health evidence and its prepared export?",isPresented:$confirmClear,titleVisibility:.visible) {
                Button("Stop and clear local Health queue",role:.destructive) { Task { await health.clear() } }
            } message: { Text("This removes only app-owned phone copies. It does not delete records from Apple Health or your desktop Vault.") }
                }
            }

            .onChange(of:phase) { _,value in if value == .active { health.restore();sleep.restore();Task { await health.collector?.checkNow(); await sleep.collector?.checkNow() } } }
            .task(id:phase) {
                guard phase == .active else{return}
                health.restore(); sleep.restore()
                // Connection maintenance belongs to the app, not the Connections sheet.
                // Fresh Watch/collector events still trigger delivery immediately.
                while !Task.isCancelled {
                    await sleep.deliver()
                    if await health.automatic?.mode() == "healthkit" { await health.deliver() }
                    do { try await Task.sleep(nanoseconds:5_000_000_000) } catch { return }
                }
            }
        }
    }
}
struct HealthControls:View {
    @ObservedObject var collector:HealthCollector
    @State private var days=1
    @State private var working=false
    @State private var actionStatus=""
    @State private var note=""
    var body:some View {
        Section("Private heart-rate review") {
            Text("Read heart-rate records available in this iPhone’s Health store, including records synced from its paired Apple Watch. Review your measurements and add your own screen-only note. No diagnosis, emotion scoring or automatic alerts.")
            Text(collector.status).accessibilityLabel("Collector status: \(collector.status)")
            if !actionStatus.isEmpty { Text(actionStatus) }
            Button("Request heart-rate access") { run { try await collector.authorizeForWellbeing() } }.disabled(working || !collector.available)
            if collector.selectedSince == nil {
                Picker("Initial history",selection:$days) { Text("Last 24 hours").tag(1);Text("Last 7 days").tag(7) }.disabled(working)
            } else if let since=collector.selectedSince {
                Text("Selected from \(since.formatted()). Resuming keeps this window and its saved anchor.").font(.caption)
            }
            Button(collector.selectedSince == nil ? "Start selected collection" : "Resume selected collection") {
                run { try await collector.startAfterExplicitOptIn(since:Date().addingTimeInterval(-Double(days)*86400)) }
            }.disabled(working || collector.running || !collector.available)
            Button("Check now") { run { await collector.checkNow() } }.disabled(working || !collector.running)
            Button("Stop collection") { run { try await collector.stop() } }.disabled(working || !collector.running)
            Text("Read permission remains unknown when no samples are returned. Watch sync and background sampling have no guaranteed cadence. This does not start a workout or collect directly from the Watch.").font(.caption)
        }
        Section("Collector status") {
            LabeledContent("Health store",value:collector.available ? "Available; read access not inferred" : "Unavailable")
            LabeledContent("Collection",value:collector.running ? "Running" : "Paused")
            LabeledContent("Queued deliveries",value:String(collector.backlog))
            LabeledContent("Recovery failures",value:String(collector.failures))
            Text("Background: \(collector.backgroundStatus)")
            Text("Last measurement: \(collector.lastMeasurement?.formatted() ?? "None observed")")
            Text("Last receipt: \(collector.lastReceived?.formatted() ?? "None observed")")
            Text("Up to 10,000 deliveries stay protected on this phone. Export at most 200 per batch. A full queue retains its anchor for retry after acknowledgement.").font(.caption)
        }
        Section("Recent queued evidence · latest 20") {
            if collector.recent.isEmpty { Text("No queued heart-rate records. This can mean no readable samples, pending sync, or a batch already acknowledged.") }
            ForEach(collector.recent) { item in
                VStack(alignment:.leading,spacing:4) {
                    Text("\(item.bpm.formatted()) bpm").font(.headline)
                    Text("Measured \(item.measured.formatted())")
                    Text("Received \(item.received.formatted()) · lag \(Int(item.deliveryLag)) seconds")
                    Text(item.watchRecorded ? "Device metadata: Apple Watch" : "Device model not confirmed as Apple Watch")
                    Text("Source: \(item.source)").font(.caption)
                }
            }
            Text("Intervals between listed measurements are gaps in evidence, not continuous monitoring. All transferred HealthKit samples are labelled historical.").font(.caption)
            TextEditor(text:$note).frame(minHeight:60).accessibilityLabel("Screen-only personal note")
            Text("This note is an unsaved draft. It is not exported and disappears when the app closes.").font(.caption)
        }
        .task {
            while !Task.isCancelled {
                await collector.refreshReview()
                do { try await Task.sleep(nanoseconds:5_000_000_000) } catch { return }
            }
        }
    }
    private func run(_ work:@escaping () async throws -> Void) {
        working=true;actionStatus="Working…"
        Task {
            do { try await work();actionStatus="" }
            catch { actionStatus="Action could not finish. Read access remains unknown. Unlock the phone and retry; queued evidence is retained." }
            working=false
        }
    }
}

struct AutomaticDeliveryView:View {
    @ObservedObject var health:HealthSession
    @State private var importing=false
    @State private var message="Import a pairing file from BODY → My private HealthKit data → Automatic iPhone → Mac delivery."
    var body:some View{
        Section("Automatic Mac delivery"){
            Text(health.deliveryStatus)
            Text(health.previewStatus)
            Button("Start companion feed"){Task{do{try await health.automatic?.setPreviewEnabled(true);await health.deliver()}catch{message="Start automatic delivery with a HealthKit pairing first."}}}
            Button("Stop companion feed"){Task{try? await health.automatic?.setPreviewEnabled(false);await health.updateDeliveryStatus()}}
            Text("Companion feed sends the latest available Watch heart-rate reading, including its measurement time, to the paired Mac while collection is on. Enable Go live in BODY. Older readings retain a labelled last-known pose. It does not accept evidence or clear your queue. Watch sync and iOS background timing can delay readings; keep this app open for the rehearsal.").font(.caption)
            Text(message).font(.caption)
            Button("Import Mac pairing file"){importing=true}
            Button("Start automatic delivery"){Task{do{try await health.automatic?.start();await health.deliver()}catch{message="Pairing unavailable. Import the local Mac pairing file first."}}}.disabled(health.automatic == nil)
            Button("Retry delivery now"){Task{do{try await health.automatic?.start();await health.deliver()}catch{message="Pairing unavailable."}}}
            Button("Stop automatic delivery"){Task{do{try await health.automatic?.stop();await health.updateDeliveryStatus()}catch{message="Unlock the phone and retry to save the pause."}}}
            Button("Forget Mac pairing",role:.destructive){Task{do{try await health.automatic?.stop(forget:true);await health.updateDeliveryStatus()}catch{message="Could not remove saved pairing. Unlock and retry."}}}
            Text("Pairing grants this Mac access to the selected source queue only. Start sends queued batches automatically over certificate-pinned HTTPS. The Mac must be awake, on the same private network and have its Vault unlocked with receiver running. Review remains on the Mac. Stopping delivery keeps collected evidence; Stop collection controls HealthKit reads separately.").font(.caption)
        }
        .fileImporter(isPresented:$importing,allowedContentTypes:[.json]){result in
            Task{do{
                let url=try result.get(),access=url.startAccessingSecurityScopedResource();defer{if access{url.stopAccessingSecurityScopedResource()}}
                let handle=try FileHandle(forReadingFrom:url);defer{try? handle.close()}
                let data=try handle.read(upToCount:4097) ?? Data();try await health.automatic?.install(data)
                message="Pairing imported. Delete its transferred file after checking the connection; keep it out of cloud storage and chat."
                await health.updateDeliveryStatus()
            }catch{message="Pairing file not accepted. Use the file downloaded from your local Mac receiver."}}
        }
    }
}
