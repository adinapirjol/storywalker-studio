/** Fictional inputs only; all storage, validation and export effects are intercepted. */
import {beforeEach,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
const io=vi.hoisted(()=>({export:vi.fn(),threshold:vi.fn(),stage:vi.fn(),decide:vi.fn(),batch:{version:1,batch_id:'00000000-0000-4000-8000-000000000002',mode:'healthkit',observations:[],deletions:[]}}));
vi.mock('@/lib/vault/vault-session',()=>({VAULT_SESSION_COOKIE:'session',readVaultSession:()=>({key:Buffer.alloc(32)}),vaultSessionFailure:()=>undefined}));
vi.mock('@/lib/vault/vault-route-access',()=>({withBrowserVault:async(_id:unknown,work:(vault:unknown)=>unknown)=>work({})}));
vi.mock('./native-transfer',()=>({decodeTransfer:()=>({plaintext:Buffer.alloc(1),key:Buffer.alloc(32),digest:'fictional'}),validateNativePacket:async()=>io.batch,stageNativeTransfer:io.stage,decideNativeTransfer:io.decide}));
vi.mock('@/lib/body/health-summary',()=>({exportReceivedSummary:io.export,clearLiveSummary:vi.fn()}));
vi.mock('@/lib/body/health-threshold',()=>({observeThresholdBatch:io.threshold,clearThresholdSession:vi.fn()}));
import {POST} from '@/app/api/context-native/route';
import {receiveTransfer,type ReceiverConfig} from './native-receiver';
import type {OpenVault} from '@/lib/vault/private-vault';
const request=(body:object)=>new NextRequest('http://localhost:3000/api/context-native',{method:'POST',headers:{host:'localhost:3000',origin:'http://localhost:3000',cookie:'session=fictional'},body:JSON.stringify(body)});
beforeEach(()=>{vi.clearAllMocks();io.stage.mockReturnValue({id:'fictional',status:'pending-review'});io.decide.mockReturnValue({status:'accepted-evidence'});});
it('H1: browser staging never triggers an external summary',async()=>{
 expect((await POST(request({action:'stage',envelope:'YQ==',key:'fictional'}))).status).toBe(200);
 expect(io.stage).toHaveBeenCalledOnce();expect(io.export).not.toHaveBeenCalled();
});
it('H1: native delivery and repeated delivery remain private pending review',async()=>{
 for(let i=0;i<2;i++)await receiveTransfer({} as OpenVault,{mode:'healthkit'} as ReceiverConfig,{action:'deliver',envelope:'YQ==',key:'fictional'});
 expect(io.stage).toHaveBeenCalledTimes(2);expect(io.export).not.toHaveBeenCalled();expect(io.threshold).not.toHaveBeenCalled();
});
it.each(['accept','delete'])('H1: %s never grants export consent',async action=>{
 expect((await POST(request({action,id:'fictional',revision:1}))).status).toBe(200);
 expect(io.decide).toHaveBeenCalledOnce();expect(io.export).not.toHaveBeenCalled();
});
