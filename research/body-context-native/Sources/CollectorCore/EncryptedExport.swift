#if canImport(CryptoKit)
import Foundation
import CryptoKit
public enum EncryptedExport {
    /// Caller supplies a separately transferred 256-bit key. No plaintext file or network endpoint.
    public static func seal(_ snapshot: QueueSnapshot, key: Data) throws -> Data {
        guard key.count == 32 else { throw ExportError.invalidKey }
        let bytes = try PropertyListEncoder().encode(snapshot)
        guard let combined = try AES.GCM.seal(bytes, using: SymmetricKey(data:key)).combined else { throw ExportError.invalidEnvelope }
        return combined
    }
    public static func open(_ envelope: Data, key: Data) throws -> QueueSnapshot {
        guard key.count == 32 else { throw ExportError.invalidKey }
        let bytes = try AES.GCM.open(AES.GCM.SealedBox(combined:envelope), using:SymmetricKey(data:key))
        return try PropertyListDecoder().decode(QueueSnapshot.self,from:bytes)
    }
}
public enum ExportError: Error { case invalidKey, invalidEnvelope }
#endif
