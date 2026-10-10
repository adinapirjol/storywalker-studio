import Foundation
import WatchConnectivity

/// Reachable messages only. No queued user-info or application-context health payloads.
@MainActor final class PhoneWatchBridge:NSObject,WCSessionDelegate {
    private weak var health:HealthSession?
    init(health:HealthSession) {
        self.health=health;super.init()
        if WCSession.isSupported(){WCSession.default.delegate=self;WCSession.default.activate()}
    }
    nonisolated func session(_ session:WCSession,activationDidCompleteWith activationState:WCSessionActivationState,error:Error?) {
        Task { @MainActor [weak self] in self?.health?.watchStatus=error == nil ? "Direct Watch connector ready; waiting for the Watch app." : "Direct Watch connector unavailable. Reopen both apps." }
    }
    nonisolated func sessionDidBecomeInactive(_ session:WCSession) {}
    nonisolated func sessionDidDeactivate(_ session:WCSession) { session.activate() }
    nonisolated func session(_ session:WCSession,didReceiveMessageData data:Data,replyHandler:@escaping(Data)->Void) {
        guard data.count<=2048 else{replyHandler(Data("rejected".utf8));return}
        Task { @MainActor [weak self] in
            let received=await self?.health?.receiveWatch(data) ?? false
            replyHandler(Data((received ? "received":"not-received").utf8))
        }
    }
}
