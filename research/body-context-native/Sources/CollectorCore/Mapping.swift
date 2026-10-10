import Foundation
public enum ObservationMapping {
    public enum Acquisition: String { case live, historical, simulated }
    public static func heart(id: String, source: String, revision: String, start: Date, end: Date, received: Date, value: Double, originalTimezone: String?, acquisition: Acquisition = .live, watchRecorded: Bool = false) throws -> Data {
        guard value.isFinite, end >= start, id.count <= 100, source.count <= 100 else { throw MappingError.invalidObservation }
        let iso = ISO8601DateFormatter()
        var quality = originalTimezone == nil ? ["original_timezone_unknown"] : []
        if watchRecorded { quality.append("recorded_on_apple_watch") }
        let packet: [String:Any] = ["schema_version":1,"id":id,"source_id":source,"source_type":acquisition == .simulated ? "fictional" : "healthkit","source_revision":revision,"event_start":iso.string(from:start),"event_end":iso.string(from:end),"received_at":iso.string(from:received),"original_offset":originalTimezone ?? "unknown","semantics":"measurement","acquisition":acquisition.rawValue,"provenance":"source_recorded","quality":quality,"payload":["kind":"heart_rate","value":value,"unit":"bpm"]]
        return try JSONSerialization.data(withJSONObject:packet)
    }
}
public enum MappingError: Error { case invalidObservation }
