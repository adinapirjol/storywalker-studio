import {it,expect} from 'vitest';
import {boundedText} from './context-request';
it('limits actual streamed UTF-8 bytes rather than trusting Content-Length',async()=>{
 await expect(boundedText(new Request('http://localhost',{method:'POST',body:'€€'}),5)).rejects.toThrow('request_limit');
 expect(await boundedText(new Request('http://localhost',{method:'POST',body:'€'}),3)).toBe('€');
});
it('decodes split UTF-8 and cancels malformed or abandoned streams',async()=>{
 const request=(stream:ReadableStream<Uint8Array>,signal?:AbortSignal)=>new Request('http://localhost',{method:'POST',body:stream,signal,duplex:'half'} as RequestInit);
 const bytes=new TextEncoder().encode('€');
 const split=new ReadableStream<Uint8Array>({start(c){c.enqueue(bytes.slice(0,1));c.enqueue(bytes.slice(1));c.close();}});
 expect(await boundedText(request(split),3)).toBe('€');
 let cancelled=false;
 const malformed=new ReadableStream<Uint8Array>({start(c){c.enqueue(new Uint8Array([255]));},cancel(){cancelled=true;}});
 await expect(boundedText(request(malformed),3)).rejects.toThrow();expect(cancelled).toBe(true);
 cancelled=false;const controller=new AbortController();
 const idle=new ReadableStream<Uint8Array>({cancel(){cancelled=true;}});
 const pending=boundedText(request(idle,controller.signal),10);controller.abort();
 await expect(pending).rejects.toThrow();expect(cancelled).toBe(true);
});
