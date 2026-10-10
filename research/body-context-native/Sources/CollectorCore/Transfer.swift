import Foundation
import CryptoKit

/// Bounded, versioned wire format. Queue anchors never leave the phone.
public struct TransferBatch: Codable, Sendable {
    public let version: Int
    public let batch_id: String
    public let mode: String
    public let deliveries: [Delivery]
}
public struct PendingTransfer: Codable, Sendable {
    public let batchID: String
    public let mode: String
    public let key: Data
    public let envelope: Data
    public let deliveryIDs: Set<String>
    public let queueEpoch: UInt64
    public var digest: String { SHA256.hash(data: envelope).map { String(format:"%02x", $0) }.joined() }
    public var keyText: String { key.base64EncodedString() }
}
public struct TransferReceipt: Codable {
    public let version: Int
    public let batch_id: String
    public let envelope_sha256: String
    public let status: String
    public let mac: String
}
public enum TransferError: Error { case invalid, empty, wrongReceipt }
public enum TransferCodec {
    public static func prepare(_ snapshot: QueueSnapshot, mode: String) throws -> PendingTransfer {
        guard ["simulated", "healthkit"].contains(mode) else { throw TransferError.invalid }
        let deliveries = Array(snapshot.pending.prefix(200))
        guard !deliveries.isEmpty else { throw TransferError.empty }
        let batchID = UUID().uuidString.lowercased()
        let key = SymmetricKey(size: .bits256).withUnsafeBytes { Data($0) }
        let bytes = try JSONEncoder().encode(TransferBatch(version:1,batch_id:batchID,mode:mode,deliveries:deliveries))
        guard bytes.count <= 1_048_576 else { throw TransferError.invalid }
        // Wire bytes: 12-byte nonce || ciphertext || 16-byte GCM tag; fixed version AAD.
        guard let envelope = try AES.GCM.seal(bytes, using:SymmetricKey(data:key), authenticating:Data("storywalker-transfer-v1".utf8)).combined else { throw TransferError.invalid }
        return PendingTransfer(batchID:batchID,mode:mode,key:key,envelope:envelope,deliveryIDs:Set(deliveries.map(\.id)),queueEpoch:snapshot.epoch)
    }
    public static func verify(_ bytes: Data, pending: PendingTransfer) throws {
        guard bytes.count <= 4096 else { throw TransferError.wrongReceipt }
        let r = try JSONDecoder().decode(TransferReceipt.self,from:bytes)
        guard r.version == 1, r.status == "accepted-evidence", r.batch_id == pending.batchID, r.envelope_sha256 == pending.digest,
              let mac = Data(base64Encoded:r.mac) else { throw TransferError.wrongReceipt }
        let message = Data("storywalker-receipt-v1\n\(r.batch_id)\n\(r.envelope_sha256)\naccepted-evidence".utf8)
        guard HMAC<SHA256>.isValidAuthenticationCode(mac,authenticating:message,using:SymmetricKey(data:pending.key)) else { throw TransferError.wrongReceipt }
    }
}
/// The key and retry manifest stay in protected, backup-excluded application storage.
/// Exporting a file does not acknowledge anything. Only a verified Vault receipt does.
public actor TransferStore {
    private let url: URL
    public init(url: URL) { self.url = url }
    public func current() throws -> PendingTransfer? {
        guard FileManager.default.fileExists(atPath:url.path) else { return nil }
        return try PropertyListDecoder().decode(PendingTransfer.self,from:Data(contentsOf:url))
    }
    public func invalidateDeletedSources(_ ids:Set<String>) throws {
        guard !ids.isEmpty,let pending=try current(),pending.mode == "healthkit",
              !pending.deliveryIDs.isDisjoint(with:ids) else { return }
        try discard()
    }
    public func prepare(queue: ProtectedQueue, mode: String) async throws -> PendingTransfer {
        if let pending = try current() { return pending }
        let snapshot = await queue.snapshot()
        if let pending = try current() { return pending }
        let pending = try TransferCodec.prepare(snapshot,mode:mode)
        try FileManager.default.createDirectory(at:url.deletingLastPathComponent(),withIntermediateDirectories:true)
        let bytes = try PropertyListEncoder().encode(pending)
        #if os(iOS)
        try bytes.write(to:url,options:[.atomic,.completeFileProtectionUntilFirstUserAuthentication])
        #else
        try bytes.write(to:url,options:.atomic)
        try FileManager.default.setAttributes([.posixPermissions:0o600],ofItemAtPath:url.path)
        #endif
        var resource=url; var values=URLResourceValues();values.isExcludedFromBackup=true;try resource.setResourceValues(values)
        return pending
    }
    public func acknowledge(_ receipt: Data, queue: ProtectedQueue) async throws {
        guard let pending=try current() else { throw TransferError.wrongReceipt }
        try TransferCodec.verify(receipt,pending:pending)
        try await queue.acknowledgeTransfer(pending.deliveryIDs,epoch:pending.queueEpoch)
        try discard() // Crash before this point is safe: the same receipt can be retried.
    }
    public func discard() throws {
        if FileManager.default.fileExists(atPath:url.path) { try FileManager.default.removeItem(at:url) }
    }
}
