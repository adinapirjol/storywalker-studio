#if os(iOS)
import Foundation
import HealthKit
import CoreLocation
import Combine

@MainActor public final class HealthCollector: ObservableObject {
    public var onQueued: (() async -> Void)?
    private let store = HKHealthStore()
    public enum Kind { case heart, sleep }
    private let kind: Kind
    private var sampleType: HKSampleType? { kind == .heart ? HKObjectType.quantityType(forIdentifier:.heartRate) : HKObjectType.categoryType(forIdentifier:.sleepAnalysis) }
    private let queue: ProtectedQueue
    private let transfers: TransferStore?
    private var observer: HKObserverQuery?
    private var syncing = false
    private var paused = true
    private var generation = 0
    private var needsAnotherPass = false
    private var completions: [HKObserverQueryCompletionHandler] = []
    private var retryTask: Task<Void, Never>?
    private var queryTask: HKAnchoredObjectQuery?
    private var queryTimeout: Task<Void, Never>?
    private var queryID: UUID?
    private typealias Page = ([HKSample], [HKDeletedObject], HKQueryAnchor?)
    private var continuation: CheckedContinuation<Page, Error>?
    @Published public private(set) var status = "Ready. Request heart-rate read access, then start collection."
    @Published public private(set) var backgroundStatus = "Not requested"
    @Published public private(set) var running = false
    @Published public private(set) var backlog = 0
    @Published public private(set) var failures = 0
    @Published public private(set) var lastMeasurement: Date?
    @Published public private(set) var lastReceived: Date?
    @Published public private(set) var selectedSince: Date?
    @Published public private(set) var recent: [HeartReview] = []
    public var available: Bool { HKHealthStore.isHealthDataAvailable() }
    public init(queue: ProtectedQueue,transfers:TransferStore?=nil,kind:Kind = .heart) { self.queue = queue;self.transfers=transfers;self.kind=kind; if kind == .sleep { status="Sleep collection paused. Request read access, then start." } }

    public func authorizeForWellbeing() async throws {
        guard available, let heart=sampleType else { status="Health data unavailable on this device";return }
        try await store.requestAuthorization(toShare:[],read:[heart])
        status="Read request completed. Apple does not reveal whether read access was granted. Start to check available samples."
    }
    /// Called synchronously during application launch: no prompt, no new opt-in.
    public func restoreAtLaunch() {
        guard let selection=queue.launchSelection, selection.enabled, available else { return }
        installObserver()
        Task { await enableDeliveryAndSync() }
    }
    public func startAfterExplicitOptIn(since:Date = Date().addingTimeInterval(-86400)) async throws {
        guard available else { status="Health data unavailable on this device";return }
        try await queue.selectCollection(since:since)
        installObserver()
        await enableDeliveryAndSync()
    }
    private func installObserver() {
        guard observer == nil, let heart=sampleType else { return }
        paused=false;running=true;generation += 1
        let token=generation
        let query=HKObserverQuery(sampleType:heart,predicate:nil) { [weak self] _,completion,error in
            Task { @MainActor [weak self] in
                guard let self,!self.paused,self.generation == token else { completion();return }
                self.completions.append(completion)
                if error != nil { self.status="Observer update failed; recovering from saved anchor." }
                await self.incremental(heart)
            }
        }
        observer=query;store.execute(query)
    }
    private func enableDeliveryAndSync() async {
        guard let heart=sampleType,!paused else { return }
        let token=generation
        do { try await store.enableBackgroundDelivery(for:heart,frequency:.immediate)
            backgroundStatus="Registered; delivery timing is controlled by iOS"
        } catch { backgroundStatus="Background delivery unavailable; foreground checks still work" }
        guard !paused,generation == token else {
            if paused { await disableDelivery(heart) }
            return
        }
        await incremental(heart)
    }
    public func checkNow() async {
        guard !paused,let heart=sampleType else { await refreshReview();return }
        retryTask?.cancel();retryTask=nil
        await incremental(heart)
    }
    public func refreshReview() async {
        let snapshot=await queue.snapshot()
        backlog=snapshot.pending.count;failures=snapshot.failures
        selectedSince=snapshot.collection?.since
        lastMeasurement=snapshot.lastMeasurement;lastReceived=snapshot.lastReceived
        recent=HeartReview.recent(snapshot)
    }
    private func fetch(_ heart:HKSampleType,anchor:HKQueryAnchor?,since:Date) async throws -> Page {
        let id=UUID()
        return try await withCheckedThrowingContinuation { c in
            continuation=c;queryID=id
            let predicate=HKQuery.predicateForSamples(withStart:since,end:nil,options:.strictStartDate)
            let query=HKAnchoredObjectQuery(type:heart,predicate:predicate,anchor:anchor,limit:200) { [weak self] _,samples,deleted,anchor,error in
                Task { @MainActor [weak self] in
                    guard let self else { return }
                    if let error { self.finishQuery(.failure(error),id:id) }
                    else { self.finishQuery(.success((samples ?? [],deleted ?? [],anchor)),id:id) }
                }
            }
            queryTask=query;store.execute(query)
            queryTimeout=Task { [weak self] in
                do { try await Task.sleep(nanoseconds:15_000_000_000) } catch { return }
                self?.finishQuery(.failure(CollectorError.timeout),id:id)
            }
        }
    }
    private func finishQuery(_ result:Result<Page,Error>,id:UUID?) {
        guard queryID == id,let c=continuation else { return }
        continuation=nil;queryID=nil;queryTimeout?.cancel();queryTimeout=nil
        if let queryTask { store.stop(queryTask) };queryTask=nil
        c.resume(with:result)
    }
    private func incremental(_ heart:HKSampleType) async {
        guard !paused else { drainCompletions();return }
        guard !syncing else { needsAnotherPass=true;return }
        syncing=true;let token=generation
        defer {
            syncing=false;drainCompletions()
            if needsAnotherPass && !paused && generation != token { scheduleRetry(heart,delay:1) }
        }
        do {
            var batches=0
            repeat {
                needsAnotherPass=false;batches += 1
                let snapshot=await queue.snapshot()
                guard let selection=snapshot.collection,selection.enabled else { return }
                let anchor=try snapshot.anchor.map { try NSKeyedUnarchiver.unarchivedObject(ofClass:HKQueryAnchor.self,from:$0) } ?? nil
                let (samples,deleted,nextAnchor)=try await fetch(heart,anchor:anchor,since:selection.since)
                guard !paused,generation == token else { return }
                let received=Date()
                let additions=try samples.compactMap { sample -> Delivery? in
                    if self.kind == .sleep {
                        guard let q=sample as? HKCategorySample else { return nil }
                        let packet=try ObservationMapping.sleep(id:q.uuid.uuidString,source:q.sourceRevision.source.bundleIdentifier,
                            revision:q.sourceRevision.version ?? "unknown",start:q.startDate,end:q.endDate,received:received,
                            stage:q.value,originalTimezone:q.metadata?[HKMetadataKeyTimeZone] as? String,
                            watchRecorded:q.device?.model == "Watch",device:q.device?.localIdentifier ?? q.device?.model)
                        return Delivery(id:q.uuid.uuidString,packet:packet)
                    }
                    guard let q=sample as? HKQuantitySample else { return nil }
                    let packet=try ObservationMapping.heart(id:q.uuid.uuidString,source:q.sourceRevision.source.bundleIdentifier,
                        revision:q.sourceRevision.version ?? "unknown",start:q.startDate,end:q.endDate,received:received,
                        value:q.quantity.doubleValue(for:HKUnit.count().unitDivided(by:.minute())),
                        originalTimezone:q.metadata?[HKMetadataKeyTimeZone] as? String,acquisition:.historical,
                        watchRecorded:q.device?.model == "Watch")
                    return Delivery(id:q.uuid.uuidString,packet:packet)
                }
                var next=snapshot
                let encoded=try nextAnchor.map { try NSKeyedArchiver.archivedData(withRootObject:$0,requiringSecureCoding:true) }
                try next.append(additions + deleted.map { Delivery(id:"delete:"+$0.uuid.uuidString,deletion:true,packet:Data($0.uuid.uuidString.utf8)) },anchor:encoded)
                let deletedIDs=Set(deleted.map { $0.uuid.uuidString })
                if let latest=samples.filter({!deletedIDs.contains($0.uuid.uuidString)}).max(by:{$0.startDate < $1.startDate}),latest.startDate >= (next.lastMeasurement ?? .distantPast) {
                    next.lastMeasurement=latest.startDate;next.lastReceived=received;next.lastMeasurementID=latest.uuid.uuidString
                }
                next.failures=0
                // Remove app-owned stale ciphertext before advancing past a deletion.
                try await transfers?.invalidateDeletedSources(deletedIDs)
                try await queue.commit(next) // Anchor and data become durable together.
                await refreshReview()
                if let onQueued { Task { await onQueued() } } // Durable queue first; never delay HealthKit completion for networking.
                needsAnotherPass=needsAnotherPass || samples.count + deleted.count >= 200
                status=backlog == 0 ? "Waiting for readable samples. No samples does not establish permission status." : "Selected evidence queued locally. Review and export when convenient."
            } while needsAnotherPass && !paused && generation == token && batches < 1
            if needsAnotherPass && !paused { scheduleRetry(heart,delay:1) }
        } catch {
            guard !paused,generation == token else { return }
            var next=await queue.snapshot();next.failed();try? await queue.commit(next)
            status=next.pending.count >= 9800 ? "Queue near capacity. Export and acknowledge batches, then Check now. Anchor retained." : "Read or storage check failed. Anchor retained. Unlock the phone and Check now to retry."
            await refreshReview()
            if next.failures < 6 { scheduleRetry(heart,delay:next.retryDelay) }
        }
    }
    private func drainCompletions() { let callbacks=completions;completions=[];callbacks.forEach { $0() } }
    private func scheduleRetry(_ type:HKSampleType,delay:TimeInterval) {
        retryTask?.cancel()
        retryTask=Task { [weak self] in
            do { try await Task.sleep(nanoseconds:UInt64(delay * 1_000_000_000)) } catch { return }
            await self?.incremental(type)
        }
    }
    public func stop() async throws {
        paused=true;running=false;generation += 1;retryTask?.cancel();retryTask=nil
        if let observer { store.stop(observer) };observer=nil
        finishQuery(.failure(CancellationError()),id:queryID);drainCompletions()
        // Persist pause before awaiting the OS, so a relaunch cannot restart collection.
        var pauseError:Error?
        do { try await queue.pauseCollection() } catch { pauseError=error }
        if let heart=sampleType {
            await disableDelivery(heart)
        }
        backgroundStatus="Stopped";status="Paused. Queued evidence retained; Health source records unchanged."
        await refreshReview()
        if let pauseError { throw pauseError }
    }
    private func disableDelivery(_ heart:HKSampleType) async {
        await withCheckedContinuation { c in store.disableBackgroundDelivery(for:heart) { _,_ in c.resume() } }
    }
}
private enum CollectorError: Error { case timeout }
public final class MinimalLocation: NSObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    public struct ApproximateLocation { public let latitude:Double;public let longitude:Double;public let accuracyMetres:Double;public let measuredAt:Date }
    public private(set) var latest: ApproximateLocation?
    private var requested=false
    public private(set) var status = "separate permission required"
    public override init() { super.init(); manager.delegate = self; manager.desiredAccuracy = kCLLocationAccuracyKilometer }
    public func requestOnceAfterExplicitOptIn() { requested=true; manager.requestWhenInUseAuthorization(); locationManagerDidChangeAuthorization(manager) }
    public func locationManagerDidChangeAuthorization(_ manager:CLLocationManager) {
        if requested && (manager.authorizationStatus == .authorizedWhenInUse || manager.authorizationStatus == .authorizedAlways) { requested=false;manager.requestLocation() }
        if manager.authorizationStatus == .denied || manager.authorizationStatus == .restricted { requested=false;status="location permission unavailable" }
    }
    public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) { guard let location=locations.last,location.horizontalAccuracy>=0 else {status="location accuracy unavailable";return};latest=ApproximateLocation(latitude:(location.coordinate.latitude*100).rounded()/100,longitude:(location.coordinate.longitude*100).rounded()/100,accuracyMetres:max(1500,location.horizontalAccuracy),measuredAt:location.timestamp); status = "approximate foreground location; rounded grid and uncertainty" }
    public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) { status = "location unavailable" }
}
#endif
