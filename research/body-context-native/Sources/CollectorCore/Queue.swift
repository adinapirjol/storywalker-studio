import Foundation
public struct Delivery: Codable, Equatable, Sendable {
    public let id: String
    public let deletion: Bool
    public let packet: Data?
    public init(id: String, deletion: Bool = false, packet: Data? = nil) { self.id = id; self.deletion = deletion; self.packet = packet }
}
public struct QueueSnapshot: Codable, Sendable {
    public var epoch: UInt64 = 0
    public var revision: UInt64? = 0
    public var anchor: Data?
    public var pending: [Delivery] = []
    public var failures: Int = 0
    public var collection: CollectionSelection?
    public var lastMeasurement: Date?
    public var lastReceived: Date?
    public var lastMeasurementID: String?
    public init() {}
    public mutating func append(_ items: [Delivery], anchor: Data?) throws {
        let deleted=Set((pending + items).filter(\.deletion).compactMap { $0.packet.flatMap { String(data:$0,encoding:.utf8) } })
        let retained=pending.filter { $0.deletion || !deleted.contains($0.id) }
        var ids = Set(retained.map(\.id))
        let additions = items.filter { ($0.deletion || !deleted.contains($0.id)) && ids.insert($0.id).inserted }
        guard retained.count + additions.count <= 10000 else { throw QueueError.full }
        pending = retained + additions
        if let id=lastMeasurementID,deleted.contains(id) { lastMeasurementID=nil;lastMeasurement=nil;lastReceived=nil }
        self.anchor = anchor
    }
    public mutating func acknowledge(_ ids: Set<String>) { pending.removeAll { ids.contains($0.id) }; failures = 0 }
    public mutating func failed() { failures = min(failures + 1, 6) }
    public var retryDelay: TimeInterval { min(pow(2, Double(failures)), 60) }
}
public enum QueueError: Error { case full, stale }
public actor ProtectedQueue {
    public nonisolated let launchSelection: CollectionSelection?
    private var state: QueueSnapshot
    private let url: URL
    public init(url: URL) throws {
        self.url = url
        state = FileManager.default.fileExists(atPath: url.path) ? try PropertyListDecoder().decode(QueueSnapshot.self, from: Data(contentsOf: url)) : QueueSnapshot()
        launchSelection = state.collection
    }
    public func snapshot() -> QueueSnapshot { state }
    public func selectCollection(since: Date) throws {
        var next=state
        // An anchored query must retain its predicate across stop/resume.
        if next.collection == nil {
            guard next.anchor == nil else { throw QueueError.stale }
            next.collection=CollectionSelection(since:since,enabled:true)
        } else { next.collection?.enabled=true }
        next.failures=0;try commit(next)
    }
    public func pauseCollection() throws { var next=state;next.collection?.enabled=false;try commit(next) }
    public func commit(_ next: QueueSnapshot) throws {
        guard next.epoch == state.epoch, next.revision == state.revision else { throw QueueError.stale }
        var updated = next; updated.revision = (state.revision ?? 0) + 1
        try persist(updated)
    }
    private func persist(_ next: QueueSnapshot) throws {
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        let bytes = try PropertyListEncoder().encode(next)
        #if os(iOS)
        try bytes.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        #else
        try bytes.write(to: url, options: .atomic)
        try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: url.path)
        #endif
        var resource = url
        var values = URLResourceValues(); values.isExcludedFromBackup = true
        try resource.setResourceValues(values)
        state = next // Advance only after the anchor and recoverable deliveries are durable together.
    }
    public func acknowledge(_ ids: Set<String>) throws { var next=state;next.acknowledge(ids);try commit(next) }
    public func acknowledgeTransfer(_ ids: Set<String>, epoch: UInt64) throws {
        guard epoch == state.epoch else { throw QueueError.stale }
        try acknowledge(ids)
    }
    public func clear() throws { var next=QueueSnapshot();next.epoch=state.epoch+1;try persist(next) }
}
