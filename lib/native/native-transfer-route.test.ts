import {describe,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
vi.mock('@/lib/vault/vault-session',()=>({VAULT_SESSION_COOKIE:'test-session',readVaultSession:()=>undefined}));
import {POST} from '@/app/api/context-native/route';
describe('native request guards',()=>{
 it('rejects remote origins before processing a file',async()=>{
  const response=await POST(new NextRequest('http://127.0.0.1:3000/api/context-native',{method:'POST',headers:{origin:'https://outside.example'},body:'{"private":"canary"}'}));
  expect(response.status).toBe(403);expect(await response.text()).not.toContain('canary');
 });
 it('requires an unlocked Vault before reading selected packets',async()=>{
  const response=await POST(new NextRequest('http://127.0.0.1:3000/api/context-native',{method:'POST',headers:{origin:'http://127.0.0.1:3000',host:'127.0.0.1:3000'},body:'{"private":"canary"}'}));
  expect(response.status).toBe(401);expect(await response.json()).toEqual({code:'VAULT_LOCKED'});
 });
});
