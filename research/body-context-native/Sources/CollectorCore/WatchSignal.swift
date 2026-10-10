import Foundation

/// The direct display feed is temporary. Apple Health remains the source of archived evidence.
public struct WatchSignal: Codable, Sendable {
    public let version: Int
    public let id: String
    public let bpm: Double
    public let measured: Date
    public let origin: String
    public init(id:String=UUID().uuidString,bpm:Double,measured:Date,origin:String) {
        self.version=1;self.id=id;self.bpm=bpm;self.measured=measured;self.origin=origin
    }
    public func encoded() throws -> Data { try JSONEncoder().encode(self) }
    public static func decode(_ data:Data,now:Date=Date()) throws -> WatchSignal {
        guard data.count<=2048,
              let fields=try JSONSerialization.jsonObject(with:data) as? [String:Any],
              Set(fields.keys)==Set(["version","id","bpm","measured","origin"]) else { throw SignalError.invalid }
        let signal=try JSONDecoder().decode(Self.self,from:data)
        guard signal.version==1,UUID(uuidString:signal.id) != nil,
              signal.bpm.isFinite,signal.bpm>0,signal.bpm<=1000,
              ["watch-health","watch-workout"].contains(signal.origin),
              signal.measured<=now,now.timeIntervalSince(signal.measured)<=120 else { throw SignalError.invalid }
        return signal
    }
    private enum SignalError:Error { case invalid }
}
