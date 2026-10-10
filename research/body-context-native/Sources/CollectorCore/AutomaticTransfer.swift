import Foundation
import CryptoKit
import Security

public struct MacPairing: Codable, Sendable {
    public let version:Int
    public let endpoint:String
    public let mode:String
    public let token:String
    public let certificate_sha256:String
    public func validated(allowLoopback:Bool=false) throws -> MacPairing {
        guard version == 1,["simulated","healthkit"].contains(mode),
              let url=URL(string:endpoint),url.scheme == "https",url.path == "/transfer",url.query == nil,url.fragment == nil,url.user == nil,url.password == nil,
              let host=url.host,let port=url.port,(1...65535).contains(port),
              let secret=Data(base64Encoded:token),secret.count == 32,token == secret.base64EncodedString(),
              certificate_sha256.count == 64,certificate_sha256.allSatisfy({$0.isHexDigit && !$0.isUppercase}) else { throw TransferError.invalid }
        let p=host.split(separator:".").compactMap { Int($0) }
        let local=p.count == 4 && p.allSatisfy { (0...255).contains($0) } && (p[0] == 10 || (p[0] == 172 && (16...31).contains(p[1])) || (p[0] == 192 && p[1] == 168))
        guard local || (allowLoopback && host == "127.0.0.1" && mode == "simulated") else { throw TransferError.invalid }
        return self
    }
}
private final class PinnedMacDelegate:NSObject,URLSessionDelegate,URLSessionTaskDelegate,@unchecked Sendable {
    let pairing:MacPairing
    init(_ pairing:MacPairing){self.pairing=pairing}
    func urlSession(_ session:URLSession,task:URLSessionTask,didReceive challenge:URLAuthenticationChallenge,completionHandler:@escaping(URLSession.AuthChallengeDisposition,URLCredential?)->Void){
        urlSession(session,didReceive:challenge,completionHandler:completionHandler)
    }
    func urlSession(_ session:URLSession,didReceive challenge:URLAuthenticationChallenge,completionHandler:@escaping(URLSession.AuthChallengeDisposition,URLCredential?)->Void){
        guard challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
              challenge.protectionSpace.host == URL(string:pairing.endpoint)?.host,
              let trust=challenge.protectionSpace.serverTrust,
              let chain=SecTrustCopyCertificateChain(trust) as? [SecCertificate],let certificate=chain.first else { completionHandler(.cancelAuthenticationChallenge,nil);return }
        let fingerprint=SHA256.hash(data:SecCertificateCopyData(certificate) as Data).map{String(format:"%02x",$0)}.joined()
        guard fingerprint == pairing.certificate_sha256 else { completionHandler(.cancelAuthenticationChallenge,nil);return }
        // Trust only the locally paired certificate, still checking validity and hostname.
        SecTrustSetPolicies(trust,SecPolicyCreateSSL(true,challenge.protectionSpace.host as CFString))
        SecTrustSetAnchorCertificates(trust,[certificate] as CFArray)
        SecTrustSetAnchorCertificatesOnly(trust,true)
        SecTrustSetNetworkFetchAllowed(trust,false)
        guard SecTrustEvaluateWithError(trust,nil) else { completionHandler(.cancelAuthenticationChallenge,nil);return }
        completionHandler(.useCredential,URLCredential(trust:trust))
    }
    func urlSession(_ session:URLSession,task:URLSessionTask,willPerformHTTPRedirection response:HTTPURLResponse,newRequest request:URLRequest,completionHandler:@escaping(URLRequest?)->Void){completionHandler(nil)}
}
enum MacDeliveryError:Error { case rejected,locked,busy,invalidBatch,invalidResponse,invalidReceipt,missingBatch }
/// Closed messages only: never show response bodies, URLs, keys or underlying error descriptions.
enum MacDeliveryFailure {
    static func message(_ error:Error)->String {
        if let error=error as? MacDeliveryError {
            switch error {
            case .rejected:return "Mac rejected this pairing. Download the current pairing file on the Mac and import it here."
            case .locked:return "Mac Vault is locked. Unlock it and choose Resume saved pairing, then Retry delivery now."
            case .busy:return "Mac receiver is busy. Delivery will retry automatically."
            case .invalidBatch:return "Mac could not validate or stage this batch. Check the pairing source and review on the Mac."
            case .invalidResponse:return "Mac returned an unexpected response. Check the receiver and retry."
            case .missingBatch:return "Mac staging is unavailable. The retained batch will be sent again."
            case .invalidReceipt:return "Mac receipt could not be verified. The phone has not acknowledged this batch."
            }
        }
        let e=error as NSError
        if e.domain == NSURLErrorDomain {
            switch e.code {
            case NSURLErrorCannotConnectToHost:return "Cannot connect to the paired Mac receiver. Unlock the Mac Vault and Resume saved pairing; also check its address and firewall."
            case NSURLErrorTimedOut:return "Connection timed out. Check that the Mac is awake and both devices use the same private network, then retry."
            case NSURLErrorNotConnectedToInternet,NSURLErrorDataNotAllowed:return "Network unavailable or access denied. Check Wi-Fi and Storywalker's Local Network permission in iPhone Settings."
            case NSURLErrorCannotFindHost,NSURLErrorDNSLookupFailed:return "Paired Mac address is unavailable. Check the Mac network address; pair again if it changed."
            case NSURLErrorServerCertificateUntrusted,NSURLErrorServerCertificateHasBadDate,NSURLErrorServerCertificateHasUnknownRoot,NSURLErrorServerCertificateNotYetValid,NSURLErrorSecureConnectionFailed,NSURLErrorCancelled,NSURLErrorUserCancelledAuthentication:return "Secure connection was interrupted or its certificate was not accepted. Check the saved pairing and device clocks; re-import the Mac's current pairing if it changed."
            default:return "Local network request failed (code \(e.code)). Check the receiver and Local Network permission."
            }
        }
        return "Delivery could not complete. Check the prepared export and retry after unlocking both devices."
    }
}
/// Small messages share the same pinned ephemeral connection while the pairing is active.
public enum MacRequestAction:String,Sendable { case deliver,preview,receipt,heartbeat }
public protocol MacDeliveryTransport:Sendable {
    func send(_ action:MacRequestAction,pending:PendingTransfer?,to pairing:MacPairing) async throws -> Data?
    func close() async
}
public actor PairedMacConnection:MacDeliveryTransport {
    private var session:URLSession?
    private var pairingIdentity:String?
    private let allowLoopback:Bool
    public init(allowLoopback:Bool=false){self.allowLoopback=allowLoopback}
    public func close(){session?.invalidateAndCancel();session=nil;pairingIdentity=nil}
    public static func body(_ action:MacRequestAction,pending:PendingTransfer?)throws->Data {
        var object:[String:Any]=["action":action.rawValue]
        switch action {
        case .deliver,.preview:
            guard let pending else{throw TransferError.invalid}
            object["envelope"]=pending.envelope.base64EncodedString();object["key"]=pending.keyText
        case .receipt:
            guard let pending else{throw TransferError.invalid}
            object["id"]="native:batch:"+pending.batchID
        case .heartbeat:break
        }
        return try JSONSerialization.data(withJSONObject:object)
    }
    public static func result(_ data:Data,action:MacRequestAction,pending:PendingTransfer?)throws->Data? {
        guard data.count<=8192,let object=try JSONSerialization.jsonObject(with:data) as? [String:Any],let status=object["status"] as? String else{throw MacDeliveryError.invalidResponse}
        if action == .preview || action == .heartbeat {
            guard ["previewed","preview-off","preview-needed"].contains(status) else{throw MacDeliveryError.invalidResponse}
            return Data(status.utf8)
        }
        if status == "accepted-evidence",let receipt=object["receipt"],let pending {
            let result=try JSONSerialization.data(withJSONObject:receipt)
            do{try TransferCodec.verify(result,pending:pending)}catch{throw MacDeliveryError.invalidReceipt}
            return result
        }
        guard status == "pending-review" else{throw MacDeliveryError.invalidBatch}
        return nil
    }
    public func send(_ action:MacRequestAction,pending:PendingTransfer?,to pairing:MacPairing)async throws->Data? {
        let config=try pairing.validated(allowLoopback:allowLoopback)
        if let pending {guard pending.mode == config.mode else{throw TransferError.invalid}}
        let identity=config.endpoint+config.token+config.certificate_sha256
        if session == nil || pairingIdentity != identity {
            close()
            let configuration=URLSessionConfiguration.ephemeral
            configuration.urlCache=nil;configuration.httpCookieStorage=nil;configuration.urlCredentialStorage=nil
            configuration.timeoutIntervalForRequest=10;configuration.timeoutIntervalForResource=12
            configuration.httpMaximumConnectionsPerHost=2
            session=URLSession(configuration:configuration,delegate:PinnedMacDelegate(config),delegateQueue:nil)
            pairingIdentity=identity
        }
        guard let session else{throw TransferError.invalid}
        var request=URLRequest(url:URL(string:config.endpoint)!)
        request.httpMethod="POST";request.setValue("Bearer \(config.token)",forHTTPHeaderField:"Authorization");request.setValue("application/json",forHTTPHeaderField:"Content-Type")
        request.httpBody=try Self.body(action,pending:pending)
        let (bytes,response)=try await session.bytes(for:request)
        guard let http=response as? HTTPURLResponse else{throw MacDeliveryError.invalidResponse}
        switch http.statusCode {
        case 200:break
        case 403:throw MacDeliveryError.rejected
        case 404:throw MacDeliveryError.missingBatch
        case 423:throw MacDeliveryError.locked
        case 429:throw MacDeliveryError.busy
        case 422:throw MacDeliveryError.invalidBatch
        default:throw MacDeliveryError.invalidResponse
        }
        var data=Data()
        for try await byte in bytes{guard data.count<8192 else{throw MacDeliveryError.invalidResponse};data.append(byte)}
        return try Self.result(data,action:action,pending:pending)
    }
}
/// Compatibility entry point for file/network rehearsals; automatic delivery owns a reusable client.
public enum PairedMacClient {
    public static func deliver(_ pending:PendingTransfer,to pairing:MacPairing,allowLoopback:Bool=false,preview:Bool=false)async throws->Data? {
        let client=PairedMacConnection(allowLoopback:allowLoopback)
        do{let result=try await client.send(preview ? .preview : .deliver,pending:pending,to:pairing);await client.close();return result}
        catch{await client.close();throw error}
    }
}
/// One pending batch, bounded retry; no queue removal before an authenticated Vault receipt.
public actor AutomaticTransfer {
    private struct Saved:Codable {var pairing:MacPairing;var enabled:Bool}
    private let url:URL
    private let transport:any MacDeliveryTransport
    private var stagedDigest:String?
    private var lastPreviewID:String?,lastPreviewEpoch:UInt64?
    private var sentDeletions=Set<String>()
    private var previewFailures=0,previewNextAttempt=Date.distantPast
    private var saved:Saved?
    private var busy=false,generation=0,failures=0
    private var previewBusy=false,previewEnabled=false,previewAgain=false
    private var directWatch: (delivery:Delivery,measured:Date,epoch:UInt64)?
    public private(set) var previewStatus="Companion feed off."
    private var nextAttempt=Date.distantPast
    public private(set) var status="Automatic delivery is off. Import a pairing file from your Mac."
    public init(url:URL,transport:any MacDeliveryTransport=PairedMacConnection())throws{
        self.url=url;self.transport=transport
        if FileManager.default.fileExists(atPath:url.path){saved=try PropertyListDecoder().decode(Saved.self,from:Data(contentsOf:url));_ = try saved?.pairing.validated();status="Saved pairing restored. Delivery resumes when enabled and the Mac Vault is unlocked."}
    }
    private func persist()throws{
        guard let saved else{if FileManager.default.fileExists(atPath:url.path){try FileManager.default.removeItem(at:url)};return}
        var directory=url.deletingLastPathComponent()
        try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true,attributes:[.posixPermissions:0o700])
        var values=URLResourceValues();values.isExcludedFromBackup=true;try directory.setResourceValues(values)
        let data=try PropertyListEncoder().encode(saved)
        #if os(iOS)
        try data.write(to:url,options:[.atomic,.completeFileProtectionUntilFirstUserAuthentication])
        #else
        try data.write(to:url,options:.atomic);try FileManager.default.setAttributes([.posixPermissions:0o600],ofItemAtPath:url.path)
        #endif
    }
    public func install(_ data:Data)async throws{
        guard data.count<=4096 else{throw TransferError.invalid}
        let pairing=try JSONDecoder().decode(MacPairing.self,from:data).validated()
        generation+=1;previewEnabled=false;stagedDigest=nil;resetPreview();await transport.close();let previous=saved;saved=Saved(pairing:pairing,enabled:false)
        do{try persist()}catch{saved=previous;saved?.enabled=false;throw error}
        status="Paired for \(pairing.mode). Tap Start automatic delivery. Health permission and collection are separate."
    }
    public func mode()->String?{saved?.pairing.mode}
    public func enabled()->Bool{saved?.enabled == true}
    public func start()throws{guard saved != nil else{throw TransferError.invalid};saved?.enabled=true;do{try persist()}catch{saved?.enabled=false;throw error};failures=0;nextAttempt = .distantPast;status="Automatic delivery enabled. Waiting for queued samples or Mac review."}
    public func stop(forget:Bool=false)async throws{generation+=1;previewEnabled=false;resetPreview();stagedDigest=nil;previewStatus="Companion feed off.";saved?.enabled=false;if forget{saved=nil};await transport.close();try persist();status="Automatic delivery stopped. Queued evidence retained."}
    public func setPreviewEnabled(_ enabled:Bool)throws {
        guard !enabled || (saved?.pairing.mode == "healthkit" && saved?.enabled == true) else {throw TransferError.invalid}
        generation+=1;previewEnabled=enabled;resetPreview()
        previewStatus=enabled ? "Companion feed enabled. Open Go live on the Mac." : "Companion feed off."
    }
    private func resetPreview(){lastPreviewID=nil;lastPreviewEpoch=nil;sentDeletions=[];previewFailures=0;previewNextAttempt = .distantPast;directWatch=nil}
    /// Reachable Watch messages bypass Health sync and archival receipts. Never write them to the queue.
    public func offerWatchSignal(_ signal:WatchSignal,queue:ProtectedQueue,now:Date=Date()) async throws {
        let signal=try WatchSignal.decode(signal.encoded(),now:now)
        guard previewEnabled,saved?.enabled == true,saved?.pairing.mode == "healthkit" else{return}
        let snapshot=await queue.snapshot()
        guard snapshot.collection?.enabled == true,previewEnabled else{return}
        guard directWatch == nil || signal.measured>directWatch!.measured else{return}
        // Initialize the epoch before storing the temporary signal; a later clear invalidates it.
        if lastPreviewEpoch != snapshot.epoch{resetPreview();lastPreviewEpoch=snapshot.epoch}
        let id="watch-live:"+signal.id
        let packet=try ObservationMapping.heart(id:id,source:"studio.storywalker.watch",revision:signal.origin,
            start:signal.measured,end:signal.measured,received:now,value:signal.bpm,
            originalTimezone:nil,acquisition:.live,watchRecorded:true)
        directWatch=(Delivery(id:id,packet:packet),signal.measured,snapshot.epoch)
        await previewTick(queue:queue,now:now)
    }
    /// Event-triggered by durable collector changes; the foreground timer is only retry/liveness.
    public func previewTick(queue:ProtectedQueue,now:Date=Date())async {
        if previewBusy{previewAgain=true;return}
        guard previewEnabled,let saved,saved.enabled,saved.pairing.mode == "healthkit",now>=previewNextAttempt else{return}
        previewBusy=true;let token=generation;defer{previewBusy=false;if previewAgain{previewAgain=false;Task{await self.previewTick(queue:queue)}}}
        do{
            var snapshot=await queue.snapshot()
            guard token==generation,previewEnabled else{return}
            if lastPreviewEpoch != snapshot.epoch{resetPreview();lastPreviewEpoch=snapshot.epoch}
            if let directWatch,directWatch.epoch == snapshot.epoch,now.timeIntervalSince(directWatch.measured)<=120 {
                snapshot.pending.append(directWatch.delivery)
            }else{directWatch=nil}
            let deletions=snapshot.pending.filter(\.deletion)
            sentDeletions.formIntersection(Set(deletions.map(\.id)))
            let unsent=deletions.filter{!sentDeletions.contains($0.id)}
            for offset in stride(from:0,to:unsent.count,by:200) {
                var removed=QueueSnapshot();removed.pending=Array(unsent[offset..<min(offset+200,unsent.count)])
                let response=try await transport.send(.preview,pending:TransferCodec.prepare(removed,mode:"healthkit"),to:saved.pairing)
                guard token==generation,previewEnabled else{return}
                if response == Data("preview-off".utf8){resetPreview();previewStatus="Mac preview is off. Enable Go live in BODY.";return}
                sentDeletions.formUnion(removed.pending.map(\.id))
                let targets=Set(removed.pending.compactMap{$0.packet.flatMap{String(data:$0,encoding:.utf8)}})
                if let id=lastPreviewID,targets.contains(id){lastPreviewID=nil}
            }
            let selected=CompanionPreview.latest(snapshot,now:now)
            let response:Data?
            if let selected,selected.id != lastPreviewID {
                var temporary=QueueSnapshot();temporary.pending=[selected]
                response=try await transport.send(.preview,pending:TransferCodec.prepare(temporary,mode:"healthkit"),to:saved.pairing)
                guard token==generation,previewEnabled else{return}
                if response == Data("previewed".utf8){lastPreviewID=selected.id}
            }else{
                response=try await transport.send(.heartbeat,pending:nil,to:saved.pairing)
                guard token==generation,previewEnabled else{return}
                if response == Data("preview-needed".utf8) || response == Data("preview-off".utf8){lastPreviewID=nil;sentDeletions=[]}
            }
            previewFailures=0;previewNextAttempt = .distantPast
            previewStatus=response == Data("preview-off".utf8) ? "Mac preview is off. Enable Go live in BODY." : selected == nil ? "No queued Watch reading available. Mac may retain an older pose with its age; it is not a live measurement." : "Companion connected. New Watch readings are pushed as they arrive; the Mac shows measurement age."
        }catch{if token==generation && previewEnabled{lastPreviewID=nil;sentDeletions=[];previewFailures=min(previewFailures+1,6);previewNextAttempt=now.addingTimeInterval(min(60,pow(2,Double(previewFailures))));previewStatus="Companion feed waiting for the Mac. Evidence queue retained; reconnect retries back off to one minute."}}
    }
    public func tick(queue:ProtectedQueue,store:TransferStore,now:Date=Date())async{
        guard !busy,let saved,saved.enabled,now>=nextAttempt else{return}
        busy=true;let token=generation;defer{busy=false}
        do{
            let existing=try await store.current()
            if let existing,existing.mode != saved.pairing.mode {status="Another source has a prepared export. Finish or discard that export first; its queue is retained.";nextAttempt=now.addingTimeInterval(30);return}
            let snapshot=await queue.snapshot()
            guard existing != nil || !snapshot.pending.isEmpty else{status="Paired mode: \(saved.pairing.mode). No queued deliveries.";return}
            let pending=try await store.prepare(queue:queue,mode:saved.pairing.mode)
            let receipt:Data?
            if stagedDigest == pending.digest {
                do{receipt=try await transport.send(.receipt,pending:pending,to:saved.pairing)}
                catch MacDeliveryError.missingBatch {
                    guard token==generation,self.saved?.enabled == true else{return}
                    receipt=try await transport.send(.deliver,pending:pending,to:saved.pairing)
                }
            }else{receipt=try await transport.send(.deliver,pending:pending,to:saved.pairing)}
            guard token == generation,self.saved?.enabled == true else{return}
            // Source deletion/clear can invalidate an in-flight export. Never acknowledge a replacement.
            guard try await store.current()?.digest == pending.digest else{throw TransferError.invalid}
            if let receipt{try TransferCodec.verify(receipt,pending:pending);try await store.acknowledge(receipt,queue:queue);stagedDigest=nil;status="Vault receipt verified. This batch acknowledged; remaining queued batches follow automatically.";nextAttempt=now.addingTimeInterval(1)}
            else{stagedDigest=pending.digest;status="Encrypted batch staged on Mac. Review and accept it in the Vault; its receipt will return automatically.";nextAttempt=now.addingTimeInterval(15)}
            failures=0
        }catch{
            guard token == generation else{return}
            failures=min(failures+1,6);nextAttempt=now.addingTimeInterval(min(300,pow(2,Double(failures))*5))
            status=MacDeliveryFailure.message(error)+" Queue retained; retry backs off to five minutes."
        }
    }
}

public enum CompanionPreview {
    public static func latest(_ snapshot:QueueSnapshot,now:Date=Date())->Delivery? {
        guard snapshot.collection?.enabled == true else{return nil}
        let iso=ISO8601DateFormatter()
        let deleted=Set(snapshot.pending.filter(\.deletion).compactMap{$0.packet.flatMap{String(data:$0,encoding:.utf8)}})
        return snapshot.pending.compactMap { delivery -> (Delivery,Date)? in
            guard !delivery.deletion,!deleted.contains(delivery.id),let bytes=delivery.packet,
                  let object=try? JSONSerialization.jsonObject(with:bytes) as? [String:Any],
                  object["source_type"] as? String == "healthkit",
                  (object["quality"] as? [String])?.contains("recorded_on_apple_watch") == true,
                  let timestamp=object["event_start"] as? String,let measured=iso.date(from:timestamp),
                  now.timeIntervalSince(measured)>=0,
                  let payload=object["payload"] as? [String:Any],payload["kind"] as? String == "heart_rate"
            else{return nil}
            return (delivery,measured)
        }.max{$0.1<$1.1}?.0
    }
}
