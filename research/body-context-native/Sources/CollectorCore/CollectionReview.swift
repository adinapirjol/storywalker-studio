import Foundation

public struct CollectionSelection: Codable, Sendable {
    public let since: Date
    public var enabled: Bool
    public init(since:Date,enabled:Bool) { self.since=since;self.enabled=enabled }
}
/// A bounded view of queued source records, never an emotional or medical score.
public struct HeartReview: Identifiable, Sendable {
    public let id:String
    public let measured:Date
    public let received:Date
    public let bpm:Double
    public let source:String
    public let watchRecorded:Bool
    public var deliveryLag:TimeInterval { max(0,received.timeIntervalSince(measured)) }
    public static func recent(_ snapshot:QueueSnapshot,limit:Int=20) -> [HeartReview] {
        let iso=ISO8601DateFormatter()
        let deleted=Set(snapshot.pending.filter(\.deletion).compactMap { $0.packet.flatMap { String(data:$0,encoding:.utf8) } })
        return snapshot.pending.lazy.filter { !$0.deletion && !deleted.contains($0.id) }.compactMap { delivery -> HeartReview? in
            guard let data=delivery.packet,let object=try? JSONSerialization.jsonObject(with:data) as? [String:Any],
                  let payload=object["payload"] as? [String:Any],payload["kind"] as? String == "heart_rate",
                  let bpm=payload["value"] as? Double,bpm.isFinite,
                  let start=object["event_start"] as? String,let measured=iso.date(from:start),
                  let arrival=object["received_at"] as? String,let received=iso.date(from:arrival) else { return nil }
            return HeartReview(id:delivery.id,measured:measured,received:received,bpm:bpm,
                               source:object["source_id"] as? String ?? "unknown",
                               watchRecorded:(object["quality"] as? [String] ?? []).contains("recorded_on_apple_watch"))
        }.sorted { $0.measured > $1.measured }.prefix(max(0,min(limit,200))).map { $0 }
    }
}
