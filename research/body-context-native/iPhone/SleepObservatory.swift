import SwiftUI
import CollectorCore
import UniformTypeIdentifiers

/// Separate queue, anchor and transfer state: sleep must never reuse the heart anchor.
@MainActor final class SleepSession: ObservableObject {
    static let shared = SleepSession()
    @Published private(set) var collector: HealthCollector?
    @Published var status = "Sleep delivery is off."
    private var queue: ProtectedQueue?
    private var transfers: TransferStore?
    private var automatic: AutomaticTransfer?

    func restore() {
        guard queue == nil else { return }
        do {
            let directory = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
            let queue = try ProtectedQueue(url: directory.appendingPathComponent("sleep-queue.plist"))
            let transfers = TransferStore(url: directory.appendingPathComponent("sleep-transfer.plist"))
            let automatic = try AutomaticTransfer(url: directory.appendingPathComponent("sleep-mac-pairing.plist"))
            let collector = HealthCollector(queue: queue, transfers: transfers, kind: .sleep)
            collector.onQueued = { [weak self] in await self?.deliver() }
            self.queue = queue; self.transfers = transfers; self.automatic = automatic; self.collector = collector
            collector.restoreAtLaunch()
        } catch { status = "Sleep storage unavailable. Unlock the phone and retry." }
    }
    func deliver() async {
        guard let queue, let transfers, let automatic else { return }
        let background = UIApplication.shared.beginBackgroundTask(withName: "Private sleep delivery", expirationHandler: nil)
        defer { if background != .invalid { UIApplication.shared.endBackgroundTask(background) } }
        await automatic.tick(queue: queue, store: transfers)
        status = await automatic.status
    }
    func pair(_ data: Data) async throws {
        guard let automatic else { throw MappingError.invalidObservation }
        // The shared transport supports rehearsal pairing too; this collector must not.
        let pairing = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        guard pairing?["mode"] as? String == "healthkit" else { throw MappingError.invalidObservation }
        try await automatic.install(data)
        status = "Sleep pairing saved. Start sleep delivery when ready."
    }
    func startDelivery() async throws {
        guard let automatic else { throw MappingError.invalidObservation }
        try await automatic.start(); await deliver()
    }
    func stopDelivery() async throws {
        try await automatic?.stop(); status = "Sleep delivery paused. Queued records remain on this phone."
    }
    func clear() async throws {
        try await collector?.stop()
        try await automatic?.stop()
        try await transfers?.discard()
        try await queue?.clear()
        await collector?.refreshReview()
        status = "Phone sleep queue and prepared transfer cleared. Apple Health, Mac Vault and backups are unchanged."
    }
}

struct SleepObservatory: View {
    @ObservedObject var sleep: SleepSession
    @State private var importing = false
    @State private var confirmClear = false
    @State private var message = ""
    @State private var working = false
    var body: some View {
        Section("Sleep observatory") {
            Text("Read sleep already recorded in Apple Health, including synced Watch sleep. The paired Mac saves descriptive research notes automatically; no mood inference or diagnosis.")
            if let collector = sleep.collector { SleepCollectionControls(collector: collector) }
            else { Button("Prepare sleep storage") { sleep.restore() } }
            Text(sleep.status).font(.caption)
            if !message.isEmpty { Text(message).font(.caption) }
            Button("Import sleep Mac pairing file") { importing = true }.disabled(working)
            Button("Start sleep delivery") { run { try await sleep.startDelivery() } }.disabled(working)
            Button("Retry sleep delivery") { run { await sleep.deliver() } }.disabled(working)
            Button("Pause sleep delivery") { run { try await sleep.stopDelivery() } }.disabled(working)
            Button("Clear phone sleep copies", role: .destructive) { confirmClear = true }.disabled(working)
            Text("Use the HealthKit pairing file from BODY on your Mac. Keep the Mac awake on the same private network, its receiver running and Vault unlocked. Enable private Watch research in HEALTH. Sleep does not use the heart-rate companion feed or export to Logfire.").font(.caption)
        }
        .fileImporter(isPresented: $importing, allowedContentTypes: [.json]) { result in
            run {
                let url = try result.get(), access = url.startAccessingSecurityScopedResource()
                defer { if access { url.stopAccessingSecurityScopedResource() } }
                let handle = try FileHandle(forReadingFrom: url); defer { try? handle.close() }
                let data = try handle.read(upToCount: 4097) ?? Data()
                guard data.count <= 4096 else { throw MappingError.invalidObservation }
                try await sleep.pair(data)
            }
        }
        .confirmationDialog("Clear phone sleep copies?", isPresented: $confirmClear, titleVisibility: .visible) {
            Button("Stop and clear phone sleep copies", role: .destructive) { run { try await sleep.clear() } }
        } message: { Text("Stops sleep collection and delivery. Removes this phone app’s sleep queue and prepared transfer only. Apple Health records, Mac records and backups survive.") }
    }
    private func run(_ work: @escaping () async throws -> Void) {
        working = true
        Task {
            do { try await work(); message = "" }
            catch { message = "Could not complete the action. Unlock the phone and check the saved state before retrying. Pairing must be for HealthKit." }
            working = false
        }
    }
}

private struct SleepCollectionControls: View {
    @ObservedObject var collector: HealthCollector
    @State private var days = 7
    @State private var working = false
    @State private var message = ""
    var body: some View {
        Text(collector.status)
        Text("Background: \(collector.backgroundStatus). Queued: \(collector.backlog).")
        if !message.isEmpty { Text(message) }
        Button("Request Sleep read access") { run { try await collector.authorizeForWellbeing() } }.disabled(working || !collector.available)
        if let since = collector.selectedSince {
            Text("Collecting from \(since.formatted()). Resuming preserves the saved window.").font(.caption)
        } else {
            Picker("Initial sleep history", selection: $days) {
                Text("Last 7 days").tag(7); Text("Last 30 days").tag(30); Text("Last 90 days").tag(90)
            }
        }
        Button(collector.selectedSince == nil ? "Start selected sleep collection" : "Resume sleep collection") {
            run { try await collector.startAfterExplicitOptIn(since: Date().addingTimeInterval(-Double(days) * 86400)) }
        }.disabled(working || collector.running || !collector.available)
        Button("Check sleep now") { run { await collector.checkNow() } }.disabled(working || !collector.running)
        Button("Pause sleep collection") { run { try await collector.stop() } }.disabled(working || !collector.running)
        Text("No returned records does not prove permission was granted or that no sleep occurred. Sleep sync and background delivery can be delayed. Unknown original timezones are preserved and excluded from local-day calculations.").font(.caption)
    }
    private func run(_ work: @escaping () async throws -> Void) {
        working = true
        Task {
            do { try await work(); message = "" }
            catch { message = "Sleep action could not finish. Read access remains unknown; check Health permissions and unlock the phone." }
            working = false
        }
    }
}
