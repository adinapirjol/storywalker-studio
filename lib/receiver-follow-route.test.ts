import {beforeEach,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
const mocks=vi.hoisted(()=>({active:vi.fn(),configure:vi.fn(),preview:vi.fn(),open:vi.fn(),close:vi.fn()}));
vi.mock('./native-receiver',()=>({receiverSessionActive:mocks.active,configureReceiver:mocks.configure,receiverPreview:mocks.preview,receiverStatus:()=>({running:false})}));
vi.mock('./vault-session',async importOriginal=>({...await importOriginal<typeof import('./vault-session')>(),VAULT_SESSION_COOKIE:'test-session',readVaultSession:()=>({key:Buffer.alloc(32)}),assertVaultSessionActive:()=>{if(!mocks.active())throw Error('expired');}}));
vi.mock('./private-vault',()=>({openVaultWithKey:mocks.open,closeVault:mocks.close,setVaultAccessGuard:vi.fn()}));
vi.mock('./native-transaction',()=>({nativeTransaction:(work:()=>unknown)=>work()}));
import {POST} from '../app/api/context-receiver/route';
function request(action:string,origin='http://127.0.0.1:3000'){
 return new NextRequest('http://127.0.0.1:3000/api/context-receiver',{method:'POST',headers:{origin,host:'127.0.0.1:3000',cookie:'test-session=opaque-test'},body:JSON.stringify({action})});
}
beforeEach(()=>{vi.clearAllMocks();mocks.active.mockReturnValue(true);mocks.open.mockResolvedValue({});mocks.configure.mockResolvedValue({sample:null});});
it('Follow resumes the saved pairing before returning a waiting preview; poll does not restart it',async()=>{
 const response=await POST(request('follow'));expect(response.status).toBe(200);expect(await response.json()).toEqual({sample:null});
 expect(mocks.configure).toHaveBeenCalledWith({},'opaque-test','follow',undefined,undefined);expect(mocks.close).toHaveBeenCalledOnce();
 await POST(request('preview'));expect(mocks.configure).toHaveBeenCalledOnce();expect(mocks.preview).toHaveBeenCalledOnce();
});
it('requires local origin and unlock before attempting a receiver restart',async()=>{
 expect((await POST(request('follow','https://outside.example'))).status).toBe(403);
 mocks.active.mockReturnValue(false);expect((await POST(request('follow'))).status).toBe(401);
 expect(mocks.open).not.toHaveBeenCalled();expect(mocks.configure).not.toHaveBeenCalled();
});
it.each(['PAIRING_REQUIRED','HEALTHKIT_PAIRING_REQUIRED','ADDRESS_CHANGED'])('returns actionable %s without replacing the pairing',async code=>{
 mocks.configure.mockRejectedValue(Error(code));const response=await POST(request('follow'));
 expect(response.status).toBe(422);expect(await response.json()).toEqual({code});expect(mocks.close).toHaveBeenCalledOnce();
});
it('does not expose arbitrary exception content',async()=>{
 mocks.configure.mockRejectedValue(Error('SECRET-CANARY'));
 expect(await (await POST(request('follow'))).json()).toEqual({code:'RECEIVER_UNAVAILABLE'});
});
