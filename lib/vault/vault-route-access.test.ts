import {beforeEach,expect,it,vi} from 'vitest';
const io=vi.hoisted(()=>({open:vi.fn(),close:vi.fn(),guard:vi.fn()}));
vi.mock('./private-vault',()=>({openVaultWithKey:io.open,closeVault:io.close,setVaultAccessGuard:io.guard}));
import {withBrowserVault} from './vault-route-access';
import {createVaultSession,deleteVaultSession} from './vault-session';
beforeEach(()=>{vi.clearAllMocks();io.open.mockResolvedValue({database:{},key:Buffer.alloc(32)});});
it('denies a locked session before opening a private file',async()=>{
 await expect(withBrowserVault(undefined,vi.fn())).rejects.toThrow();expect(io.open).not.toHaveBeenCalled();
});
it('expiry while opening prevents private reads and erases the temporary key',async()=>{
 const {token}=createVaultSession(Buffer.alloc(32,1)),work=vi.fn();
 io.open.mockImplementationOnce(async()=>{deleteVaultSession(token);return {};});
 await expect(withBrowserVault(token,work)).rejects.toThrow('session ended');
 expect(work).not.toHaveBeenCalled();expect(io.close).toHaveBeenCalledOnce();
 expect(io.open.mock.calls[0][0].every((value:number)=>value===0)).toBe(true);
});
it('denies a late private result and binds the same authority to persistence',async()=>{
 const {token}=createVaultSession(Buffer.alloc(32,1));
 await expect(withBrowserVault(token,async()=>{deleteVaultSession(token);return 'PRIVATE-RESULT-CANARY';})).rejects.toThrow('session ended');
 expect(io.guard).toHaveBeenCalledOnce();expect(()=>io.guard.mock.calls[0][1]()).toThrow('session ended');
 expect(io.close).toHaveBeenCalledOnce();
});
it('preserves normal authorized work and closes the snapshot',async()=>{
 const {token}=createVaultSession(Buffer.alloc(32,1));
 try{expect(await withBrowserVault(token,()=>({saved:true}))).toEqual({saved:true});expect(io.close).toHaveBeenCalledOnce();}
 finally{deleteVaultSession(token);}
});

it('rejects cancellation before opening or reading a private file',async()=>{
 const {token}=createVaultSession(Buffer.alloc(32,1)),controller=new AbortController(),work=vi.fn();controller.abort();
 try{await expect(withBrowserVault(token,work,controller.signal)).rejects.toThrow();expect(io.open).not.toHaveBeenCalled();expect(work).not.toHaveBeenCalled();}
 finally{deleteVaultSession(token);}
});
