import {expect, it} from 'vitest';
import {isLocalSameOrigin,isLocalRead} from './local-origin';
it('allows origin-less loopback reads but blocks rebinding and cross-site reads',()=>{
 expect(isLocalRead(new Request('http://localhost:3000/api/vault',{headers:{host:'127.0.0.1:3000'}}))).toBe(true);
 const denied:Record<string,string>[]=[{host:'evil.example:3000'},{host:'127.0.0.1:3000','sec-fetch-site':'cross-site'},{host:'127.0.0.1:3000',origin:'https://evil.example'}];
 for(const headers of denied)expect(isLocalRead(new Request('http://localhost:3000/api/vault',{headers}))).toBe(false);
});
it('matches the actual loopback Host despite Next URL normalization',()=>{
 expect(isLocalSameOrigin(new Request('http://localhost:3000/api/vault',{headers:{host:'127.0.0.1:3000',origin:'http://127.0.0.1:3000'}}))).toBe(true);
});
it('rejects cross-origin, foreign hosts, ports, null and missing origins',()=>{
 for(const origin of ['https://evil.example','http://localhost:3000','http://127.0.0.1:3001','null','']) {
  expect(isLocalSameOrigin(new Request('http://localhost:3000/api/vault',{headers:{host:'127.0.0.1:3000',origin}}))).toBe(false);
 }
 expect(isLocalSameOrigin(new Request('http://evil.example',{headers:{host:'evil.example',origin:'http://evil.example'}}))).toBe(false);
});
