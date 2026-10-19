import Foundation
public enum ObservationMapping {
    public static func sleep(id:String,source:String,revision:String,start:Date,end:Date,received:Date,stage:Int,originalTimezone:String?,watchRecorded:Bool,device:String?) throws -> Data {
        let stages=[0:"inBed",1:"asleep",2:"awake",3:"core",4:"deep",5:"rem"]
        guard let label=stages[stage],end>start,id.count<=100,source.count<=100,revision.count<=100 else { throw MappingError.invalidObservation }
        let iso=ISO8601DateFormatter()
        var quality=originalTimezone == nil ? ["original_timezone_unknown"] : []
        if watchRecorded { quality.append("recorded_on_apple_watch") }
        var packet:[String:Any]=["schema_version":1,"id":id,"source_id":source,"source_type":"healthkit","source_revision":revision,
            "event_start":iso.string(from:start),"event_end":iso.string(from:end),"received_at":iso.string(from:received),
            "original_offset":originalTimezone ?? "unknown","semantics":"interval","acquisition":"historical","provenance":"source_recorded",
            "quality":quality,"payload":["kind":"sleep","stage":label]]
        if let device { packet["device_revision"]=String(device.prefix(100)) }
        return try JSONSerialization.data(withJSONObject:packet)
    }
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
