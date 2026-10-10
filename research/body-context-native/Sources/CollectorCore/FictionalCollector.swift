import Foundation

/// Fixed invented inputs only. Never writes synthetic data into HealthKit.
public enum FictionalCollector {
    public static func packets() throws -> [Data] {
        let base = Date(timeIntervalSince1970: 1903867200) // 2030-05-01 12:00 UTC
        let values: [Double] = [70,75,80,130,132,134,136,80,75,130,131,132,133]
        var packets = try values.enumerated().map { index, value in
            let measured = base.addingTimeInterval(Double(index * 10))
            return try ObservationMapping.heart(id: "mock-\(index)", source: "fictional-native-body", revision: "1", start: measured, end: measured, received: measured, value: value, originalTimezone: "+00:00", acquisition: .simulated)
        }
        let measured = base.addingTimeInterval(35)
        packets.append(try ObservationMapping.heart(id: "mock-late", source: "fictional-native-body", revision: "1", start: measured, end: measured, received: base.addingTimeInterval(85), value: 131, originalTimezone: nil, acquisition: .simulated))
        // Retry delivery with a stable sample ID and independent arrival time.
        for arrival in [86,87,88] {
            packets.append(try ObservationMapping.heart(id: "mock-3", source: "fictional-native-body", revision: "1", start: base.addingTimeInterval(30), end: base.addingTimeInterval(30), received: base.addingTimeInterval(Double(arrival)), value: 130, originalTimezone: "+00:00", acquisition: .simulated))
        }
        return packets
    }

    public static func checkQueue() async throws -> Int {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: folder) }
        let url = folder.appendingPathComponent("fictional-queue.plist")
        let queue = try ProtectedQueue(url: url)
        let deliveries = try packets().map { packet -> Delivery in
            let object = try JSONSerialization.jsonObject(with: packet) as! [String:Any]
            return Delivery(id: object["id"] as! String, packet: packet)
        }
        var snapshot = await queue.snapshot()
        try snapshot.append(deliveries, anchor: Data([1]))
        try await queue.commit(snapshot)
        // A new queue instance stands in for restart before receiver acknowledgement.
        let reopened = try ProtectedQueue(url: url)
        let recovered = await reopened.snapshot()
        guard recovered.pending == snapshot.pending, recovered.anchor == snapshot.anchor else { throw QueueError.stale }
        #if canImport(CryptoKit)
        let key = Data((0..<32).map { UInt8($0) }) // Fictional test key; never used for real exports.
        let encrypted = try EncryptedExport.seal(recovered, key: key)
        let decoded = try EncryptedExport.open(encrypted, key: key)
        guard decoded.pending == recovered.pending else { throw QueueError.stale }
        #endif
        try await reopened.acknowledge(Set(recovered.pending.map(\.id)))
        let acknowledged = await reopened.snapshot()
        guard acknowledged.pending.isEmpty else { throw QueueError.stale }
        return recovered.pending.count
    }
}
