import {beforeEach,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({staged:false,current:undefined as unknown,snapshot:'',put:vi.fn(),unlink:vi.fn(),close:vi.fn()}));
vi.mock('next/headers',()=>({cookies:async()=>({get:()=>({value:'fictional-session'})})}));
vi.mock('./vault-session',async importOriginal=>({...await importOriginal<typeof import('./vault-session')>(),VAULT_SESSION_COOKIE:'session',readVaultSession:()=>({key:Buffer.alloc(32)}),vaultSessionActive:()=>true,assertVaultSessionActive:()=>{}}));
vi.mock('node:fs',()=>({existsSync:()=>mock.staged,readFileSync:()=>mock.snapshot,unlinkSync:mock.unlink}));
vi.mock('./private-vault',()=>({openVaultWithKey:async()=>({}),readVaultRecord:()=>mock.current,putVaultRecords:mock.put,closeVault:mock.close,setVaultAccessGuard:vi.fn()}));
import {POST} from '../app/api/arena-rehearsal/route';
const snapshot={version:1,privacy:'private',capturedAt:'2027-07-01T00:00:00.000Z',method:'fictional test',channels:[{slug:'fictional',title:'Fictional',visibility:'private',sourceUrl:'https://www.are.na/example/fictional',fragments:[{id:1,type:'Text',title:'Invented note',text:'Fictional test only',position:1,connectedAt:'2027-07-01T00:00:00.000Z',url:'https://www.are.na/block/1'}]}]};
const composition={selected:[],hidden:[],note:''};
const old={id:'arena:private-rehearsal:v1',kind:'reference',capturedAt:snapshot.capturedAt,payload:{snapshot,composition,decisions:[],canonical:false}};
const request=(body:unknown)=>new Request('http://localhost:3000/api/arena-rehearsal',{method:'POST',headers:{Origin:'http://localhost:3000'},body:JSON.stringify(body)});
beforeEach(()=>{mock.staged=false;mock.current=structuredClone(old);mock.snapshot=JSON.stringify(snapshot);mock.put.mockReset();mock.unlink.mockReset();mock.close.mockReset();});
it('archives the old composition and imports the new snapshot in one write, removing staging afterwards',async()=>{
 mock.staged=true;const response=await POST(request({action:'load'}));expect(response.status).toBe(200);
 expect(mock.put).toHaveBeenCalledTimes(1);const records=mock.put.mock.calls[0][1];expect(records).toHaveLength(2);expect(records[0].payload).toEqual(old.payload);expect(records[0].id).toContain(':archive:');expect(records[1].payload.snapshot).toEqual(snapshot);
 expect(mock.unlink).toHaveBeenCalledOnce();expect(mock.put.mock.invocationCallOrder[0]).toBeLessThan(mock.unlink.mock.invocationCallOrder[0]);expect(mock.close).toHaveBeenCalledOnce();
});
it('retains staging when encrypted persistence fails',async()=>{
 mock.staged=true;mock.put.mockImplementation(()=>{throw Error('disk failure');});expect((await POST(request({action:'load'}))).status).toBe(400);expect(mock.unlink).not.toHaveBeenCalled();expect(mock.close).toHaveBeenCalledOnce();
});
it('saves an explicit composition without changing the source and rejects unknown references',async()=>{
 const chosen={selected:[1],hidden:[],note:'An authored test pairing'};
 expect((await POST(request({action:'save',composition:chosen}))).status).toBe(200);
 const record=mock.put.mock.calls[0][1][0];expect(record.payload.snapshot).toEqual(snapshot);expect(record.payload.composition).toEqual(chosen);expect(record.payload.decisions).toHaveLength(1);expect(record.payload.canonical).toBe(false);
 mock.put.mockClear();expect((await POST(request({action:'save',composition:{...chosen,selected:[99]}}))).status).toBe(400);expect(mock.put).not.toHaveBeenCalled();
});
