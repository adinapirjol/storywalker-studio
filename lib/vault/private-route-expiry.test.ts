import {beforeEach,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
const io=vi.hoisted(()=>({token:'',open:vi.fn(),close:vi.fn(),read:vi.fn(),headers:vi.fn(),put:vi.fn(),remove:vi.fn(),configure:vi.fn(),native:vi.fn()}));
vi.mock('./private-vault',()=>({openVaultWithKey:io.open,closeVault:io.close,setVaultAccessGuard:vi.fn(),readVaultRecord:io.read,vaultRecordHeaders:io.headers,putVaultRecords:io.put,removeVaultRecords:io.remove}));
vi.mock('@/lib/native/native-transfer',()=>({listNativeTransfers:io.native,decodeTransfer:vi.fn(),validateNativePacket:vi.fn(),privateBodyEvidence:vi.fn(),evaluatePrivateBody:vi.fn(),stageNativeTransfer:vi.fn(),previewNativeTransfer:vi.fn(),decideNativeTransfer:vi.fn(),nativeReceipt:vi.fn()}));
vi.mock('@/lib/body/health-summary',()=>({exportReceivedSummary:vi.fn()}));
vi.mock('@/lib/native/native-receiver',()=>({configureReceiver:io.configure,receiverStatus:vi.fn(),receiverSessionActive:()=>true,receiverPreview:vi.fn()}));
vi.mock('next/headers',()=>({cookies:async()=>({get:()=>({value:io.token})})}));
import {createVaultSession,deleteVaultSession,VAULT_SESSION_COOKIE} from './vault-session';
import {POST as native} from '@/app/api/context-native/route';
import {POST as receiver} from '@/app/api/context-receiver/route';
import {POST as arena} from '@/app/api/arena-rehearsal/route';
import {GET as demo} from '@/app/api/vault-demo/route';
import {GET as health,POST as healthAction} from '@/app/api/context-health/route';
function request(path:string,body?:unknown){return new NextRequest(`http://127.0.0.1:3000/api/${path}`,{method:body===undefined?'GET':'POST',headers:{host:'127.0.0.1:3000',origin:'http://127.0.0.1:3000',cookie:`${VAULT_SESSION_COOKIE}=${io.token}`},...(body===undefined?{}:{body:JSON.stringify(body)})});}
beforeEach(()=>{vi.clearAllMocks();io.token=createVaultSession(Buffer.alloc(32,1)).token;io.open.mockResolvedValue({});io.read.mockReturnValue(undefined);io.headers.mockReturnValue([]);});
it.each([
 ['native',()=>native(request('context-native',{action:'list'}))],
 ['receiver',()=>receiver(request('context-receiver',{action:'pairing'}))],
 ['arena',()=>arena(request('arena-rehearsal',{action:'load'}))],
 ['subset',()=>demo(request('vault-demo'))],
 ['health',()=>health(request('context-health'))],
] as const)('%s denies expiry during asynchronous Vault opening',async(_name,action)=>{
 io.open.mockImplementationOnce(async()=>{deleteVaultSession(io.token);return {};});
 const response=await action();expect(response.status).toBe(401);expect(await response.json()).toHaveProperty('code','VAULT_SESSION_EXPIRED');
 expect(io.read).not.toHaveBeenCalled();expect(io.native).not.toHaveBeenCalled();expect(io.configure).not.toHaveBeenCalled();expect(io.put).not.toHaveBeenCalled();expect(io.close).toHaveBeenCalledOnce();
});
it('accepts staged Health chunks and their manifest in one durable write',async()=>{
 const id='health:stage:abc',chunkIds=['health:stage:abc:0','health:stage:abc:1'];
 io.read.mockImplementation((_vault:unknown,key:string)=>({id:key,kind:'reference',capturedAt:'2030-01-01T00:00:00Z',payload:key===id?{chunkIds,status:'pending-review',count:2}:{observations:['invented']}}));
 try{
  const response=await healthAction(request('context-health',{id,action:'accept'}));expect(response.status).toBe(200);
  expect(io.put).toHaveBeenCalledOnce();expect(io.put.mock.calls[0][1]).toHaveLength(3);
  expect(io.put.mock.calls[0][1].every((record:{payload:{status:string}})=>record.payload.status==='accepted-evidence')).toBe(true);
 }finally{deleteVaultSession(io.token);}
});
it('refuses incomplete Health staging without partly accepting evidence',async()=>{
 io.read.mockReturnValueOnce({id:'health:stage:abc',payload:{chunkIds:['missing'],status:'pending-review'}}).mockReturnValue(undefined);
 try{expect((await healthAction(request('context-health',{id:'health:stage:abc',action:'accept'}))).status).toBe(409);expect(io.put).not.toHaveBeenCalled();}
 finally{deleteVaultSession(io.token);}
});
it('rejects null Health commands without opening a private file',async()=>{
 try{expect((await healthAction(request('context-health',null))).status).toBe(422);expect(io.open).not.toHaveBeenCalled();}
 finally{deleteVaultSession(io.token);}
});
