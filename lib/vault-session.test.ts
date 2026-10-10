import {afterEach,expect,it,vi} from 'vitest';
import {randomBytes} from 'node:crypto';
afterEach(()=>vi.useRealTimers());
it('replaces old browser authority without changing other browser sessions',async()=>{
 const sessions=await import('./vault-session');const key=randomBytes(32);
 const old=sessions.createVaultSession(key),other=sessions.createVaultSession(key);
 const next=sessions.rotateVaultSession(key,old.token);
 expect(sessions.vaultSessionActive(old.token)).toBe(false);
 expect(sessions.vaultSessionActive(other.token)).toBe(true);
 expect(sessions.vaultSessionActive(next.token)).toBe(true);
 sessions.deleteVaultSession(other.token);sessions.deleteVaultSession(next.token);key.fill(0);
});
it('shares unlock across route reloads without extending absolute expiry',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));
 const first=await import('./vault-session');
 const created=first.createVaultSession(randomBytes(32));
 vi.resetModules();const reloaded=await import('./vault-session');
 expect(reloaded.readVaultSession(created.token)?.expiresAt).toBe(created.expiresAt);
 vi.advanceTimersByTime(15*60*1000);
 expect(reloaded.readVaultSession(created.token)).toBeUndefined();
});
it('locks the shared session across consumers',async()=>{
 const first=await import('./vault-session');const created=first.createVaultSession(randomBytes(32));
 vi.resetModules();const other=await import('./vault-session');other.deleteVaultSession(created.token);
 expect(first.readVaultSession(created.token)).toBeUndefined();
});
it('erases owned keys on lock and expiry without erasing the caller key',async()=>{
 vi.useFakeTimers();
 const module=await import('./vault-session');const original=Buffer.alloc(32,7);
 const first=module.createVaultSession(original);
 const store=(globalThis as typeof globalThis&{__storywalkerVaultSessions:Map<string,{key:Buffer}>}).__storywalkerVaultSessions;
 const locked=store.get(first.token)!.key;module.deleteVaultSession(first.token);
 expect(locked.equals(Buffer.alloc(32))).toBe(true);expect(original[0]).toBe(7);
 const second=module.createVaultSession(original),expired=store.get(second.token)!.key;
 vi.advanceTimersByTime(15*60*1000);expect(module.readVaultSession(second.token)).toBeUndefined();expect(expired.equals(Buffer.alloc(32))).toBe(true);
});
