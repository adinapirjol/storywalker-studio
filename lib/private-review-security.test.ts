import {afterEach,expect,it,vi} from 'vitest';
import {createVaultSession,deleteVaultSession} from './vault-session';
const io=vi.hoisted(()=>({read:vi.fn(),write:vi.fn(),token:undefined as string|undefined}));
vi.mock('next/headers',()=>({cookies:async()=>({get:()=>io.token?{value:io.token}:undefined})}));
vi.mock('node:fs/promises',()=>({readFile:io.read,writeFile:io.write}));
import {GET,POST} from '../app/api/private-review/route';
const request=(write=false,host='127.0.0.1:3000',origin='http://127.0.0.1:3000')=>new Request('http://localhost:3000/api/private-review',{method:write?'POST':'GET',headers:{host,...(write?{origin}:{})},...(write?{body:JSON.stringify({action:'process-inbox',private:'canary'})}:{})});
afterEach(()=>{deleteVaultSession(io.token);io.token=undefined;vi.clearAllMocks();});
it('does not read or mutate private recovery without an unlocked session',async()=>{
 expect((await GET(request())).status).toBe(401);expect((await POST(request(true))).status).toBe(401);
 expect(io.read).not.toHaveBeenCalled();expect(io.write).not.toHaveBeenCalled();
});
it('blocks foreign origins and rebinding hosts before private file access even when unlocked',async()=>{
 io.token=createVaultSession(Buffer.alloc(32,1)).token;
 expect((await GET(request(false,'outside.example:3000'))).status).toBe(403);
 expect((await POST(request(true,'127.0.0.1:3000','https://outside.example'))).status).toBe(403);
 expect(io.read).not.toHaveBeenCalled();expect(io.write).not.toHaveBeenCalled();
});
it.each([false,true])('denies a pending recovery read/write after lock (write=%s)',async(write)=>{
 io.token=createVaultSession(Buffer.alloc(32,1)).token;
 let release!:(value:string)=>void;
 io.read.mockImplementationOnce(()=>new Promise<string>(resolve=>{release=resolve;}));
 const pending=write?POST(request(true)):GET(request());
 await vi.waitFor(()=>expect(io.read).toHaveBeenCalledOnce());
 deleteVaultSession(io.token);
 release('{"private":"fictional-private-canary"}');
 const response=await pending;
 expect(response.status).toBe(401);
 expect(await response.json()).toMatchObject({code:'VAULT_SESSION_EXPIRED'});
 expect(io.write).not.toHaveBeenCalled();
});
it('does not start a queued recovery edit when its session has ended',async()=>{
 io.token=createVaultSession(Buffer.alloc(32,1)).token;
 let release!:(value:string)=>void;
 io.read.mockImplementationOnce(()=>new Promise<string>(resolve=>{release=resolve;}));
 const first=POST(request(true));
 await vi.waitFor(()=>expect(io.read).toHaveBeenCalledOnce());
 const second=POST(request(true));
 // Complete request parsing while the first operation holds the queue.
 await new Promise(resolve=>setTimeout(resolve,10));
 deleteVaultSession(io.token);release('{}');
 expect((await first).status).toBe(401);expect((await second).status).toBe(401);
 expect(io.read).toHaveBeenCalledOnce();expect(io.write).not.toHaveBeenCalled();
});
