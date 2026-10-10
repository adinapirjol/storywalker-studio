import {expect,it,vi} from 'vitest';
import {GET,POST} from '../app/api/vault/route';
it('rejects every foreign write action before reading its payload',async()=>{
 for(const action of ['initialise','unlock','capture','search','lock-session','import-private-source']){
  const request=new Request('http://localhost:3000/api/vault',{method:'POST',headers:{host:'127.0.0.1:3000',origin:'https://outside.example'},body:JSON.stringify({action,passphrase:'fictional-secret-canary'})});
  const json=vi.spyOn(request,'json');
  const response=await POST(request);expect(response.status).toBe(403);expect(json).not.toHaveBeenCalled();expect(await response.text()).not.toContain('canary');
 }
});
it('blocks foreign Host reads and origin-less writes before cookies or Vault access',async()=>{
 expect((await GET(new Request('http://outside.example/api/vault'))).status).toBe(403);
 expect((await POST(new Request('http://localhost:3000/api/vault',{method:'POST',body:'{}'}))).status).toBe(403);
});
